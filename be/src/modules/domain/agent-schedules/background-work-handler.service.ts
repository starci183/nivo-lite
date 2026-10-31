import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import {
    InternalProposalSettlerService,
    InternalTurnContextService,
    RuntimeAgentService,
    internalTimeoutMsOf,
    stoppedBy,
} from "@modules/domain/agent-turns"
import { AgentTriggersService, AgentWorkHandlersService } from "@modules/domain/agent-work"
import type {
    AgentHandlerEnding,
    AgentTurnPrep,
    AgentTurnView,
    AgentWakeSource,
    AgentWakeView,
    AgentWorkHandler,
} from "@modules/domain/agent-work"
import { AgentDirectoryService, AgentsService, InjectInstallations } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { ModuleReadinessService } from "@modules/domain/modules"
import { threadKeyFor } from "@modules/integrations/openclaw"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentProbesService } from "./agent-probes.service"
import { InjectBackgroundVoice } from "./agent-schedules.decorators"
import { AgentSchedulesLogEvent } from "./agent-schedules.log-events"
import {
    AGENT_INACTIVE,
    NOT_APPLIED,
    STALE_SLOT,
    holdEndingOf,
    isStaleSlot,
    sayingOf,
    skippedBy,
    wakeTextOf,
} from "./background-work.policy"
import type { BackgroundVoice } from "./agent-schedules.contracts"

/** The language of the fixed lines of a background turn. */
const LOCALE: Locale = "vi"
/** The reason the drain gives a wake that died past its attempts. */
const DEAD_REASON = "error"
/** The session every background turn of an agent shares, so its schedule and events are one thread for the runtime. */
const WORK_SESSION = "work"

/** Who the wake is for: the module, the instance and the name the agent acts under. */
interface WorkAgent {
    /** The module of the agent. */
    readonly module: string
    /** The name it acts under. */
    readonly name: string
    /** Its installation, or null. */
    readonly installation: Installation | null
}

@Injectable()
/**
 * The 24/7 side of the core road: the handler of `internal` and `schedule` wakes. It checks by code first and calls the model only when
 * there is work. An agent that is gone, paused or not running, a schedule slot older than its own period, and a probe that finds
 * nothing (or fails) each end the wake as skipped with no model call and no usage row. When there is work, the turn starts from what the
 * probe found, runs in the executor under its gates, and its proposal is settled by the shared settler: tasks written, actions asked
 * through the authority gate (a background write always stops for a person), and a line to the owner only when the agent has
 * something to say.
 */
export class BackgroundWorkHandlerService implements AgentWorkHandler, OnModuleInit {
    /** The sources this handler answers: the events of the business and the clock. */
    readonly sources: ReadonlyArray<AgentWakeSource> = ["internal", "schedule"]

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        private readonly handlers: AgentWorkHandlersService,
        private readonly probes: AgentProbesService,
        private readonly triggers: AgentTriggersService,
        private readonly directory: AgentDirectoryService,
        private readonly agents: AgentsService,
        private readonly readiness: ModuleReadinessService,
        private readonly runtime: RuntimeAgentService,
        private readonly context: InternalTurnContextService,
        private readonly settler: InternalProposalSettlerService,
        @InjectBackgroundVoice() private readonly voice: BackgroundVoice,
    ) {}

    /** Registers the handler with the drain once the app has started. */
    onModuleInit(): void {
        this.handlers.add(this)
    }

    /** Decides by code whether the wake has work, and builds the turn only when it has. */
    async prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const agent = await this.agentOf(turn)
        if (agent === null) return this.ended(turn, AGENT_INACTIVE)
        const status =
            agent.installation === null ? null : await this.readiness.settle(turn.workspaceId, agent.installation.id)
        if (stoppedBy(status, agent.installation) !== null) return this.ended(turn, NOT_APPLIED)
        if (await this.isStale(turn)) return this.ended(turn, STALE_SLOT)
        const decision = await this.probes.decide(
            { workspaceId: turn.workspaceId, agentId: turn.agentId },
            turn.context,
        )
        if (decision.kind === "skip") return this.ended(turn, decision.reason)
        const runtimeAgentId = await this.runtime.agentFor(turn.workspaceId, agent.module, agent.installation)
        const message = await this.context.messageOf({
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            source: turn.source,
            locale: LOCALE,
            text: wakeTextOf(turn.context, decision.brief),
        })
        return {
            kind: "run",
            plan: {
                module: agent.module,
                runtimeAgentId,
                threadKey: threadKeyFor(runtimeAgentId, WORK_SESSION),
                message,
                timeoutMs: internalTimeoutMsOf(turn.source),
            },
        }
    }

    /** Applies the proposal through the settler, and says what the agent has to say to its owner, once per wake. */
    async settle(turn: AgentTurnView, proposal: unknown): Promise<AgentHandlerEnding> {
        const agent = await this.agentOf(turn)
        if (agent === null) return skippedBy(AGENT_INACTIVE)
        const settled = await this.settler.settle(turn, proposal, {
            module: agent.module,
            actorName: agent.name,
            locale: LOCALE,
            installationId: agent.installation?.id ?? null,
        })
        if (settled.kind === "stale") return skippedBy(STALE_SLOT)
        const text = sayingOf(settled.reply, settled.needsHuman, settled.reason)
        if (text !== "") await this.say(turn, text)
        return {
            status: "done",
            reason: null,
            outcome: { tasks: settled.tasks, actions: settled.actions, said: text !== "" },
        }
    }

    /**
     * Ends the wake without a line to anyone, because nobody waits on a clock or an event; a wake that died past its attempts is the one
     * exception, and its owner is told once that the work could not run.
     */
    async holdOver(wake: AgentWakeView, reason: string): Promise<AgentHandlerEnding> {
        if (reason === DEAD_REASON) await this.say(wake, this.catalog.get("agentSchedules.wakeDead", {}, LOCALE))
        return holdEndingOf(reason)
    }

    private ended(turn: AgentTurnView, reason: string): AgentTurnPrep {
        this.logger.info(AgentSchedulesLogEvent.WakeEnded, { agentId: turn.agentId, wakeId: turn.wakeId, reason })
        return { kind: "end", ending: skippedBy(reason) }
    }

    private async say(turn: AgentWakeView, text: string): Promise<void> {
        await this.voice.say({
            workspaceId: turn.workspaceId,
            agentId: turn.agentId,
            wakeId: turn.wakeId,
            wakeCreatedAt: turn.wakeCreatedAt,
            text,
        })
    }

    /** True for a schedule wake whose slot is older than one period of its trigger. */
    private async isStale(turn: AgentTurnView): Promise<boolean> {
        const { triggerId, slot } = turn.context
        if (turn.source !== "schedule" || triggerId === undefined) return false
        const trigger = await this.triggers.byId(triggerId)
        return isStaleSlot(slot, trigger?.preset ?? null, this.clock.now())
    }

    /** The module, name and installation of an active agent, or null when it is gone or paused. */
    private async agentOf(turn: AgentTurnView): Promise<WorkAgent | null> {
        const [facts, profile, installation] = await Promise.all([
            this.directory.chatFactsOf(turn.workspaceId, turn.agentId),
            this.agents.profileOf(turn.workspaceId, turn.agentId),
            this.installations.ofAgent(turn.workspaceId, turn.agentId),
        ])
        if (facts === null || profile === null || facts.status !== "active") return null
        return { module: facts.module, name: profile.name, installation }
    }
}
