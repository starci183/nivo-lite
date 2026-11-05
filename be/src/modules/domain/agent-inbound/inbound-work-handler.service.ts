import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentRunsService } from "@modules/domain/agent-runs"
import {
    IntentPipelineService,
    IntentTurnService,
    RuntimeAgentService,
    internalTimeoutMsOf,
    pinnedOf,
    proposalTextOf,
} from "@modules/domain/agent-turns"
import type { AgentGraphBrief } from "@modules/domain/agent-graphs"
import type { IntentPlan } from "@modules/domain/agent-turns"
import type { IntentTrigger } from "@modules/domain/intent-contracts"
import { AgentTurnsService, AgentWorkHandlersService, wakeSources } from "@modules/domain/agent-work"
import { decodeInbound } from "@modules/domain/agent-wake-rules"
import type {
    AgentHandlerEnding,
    AgentTurnPrep,
    AgentTurnView,
    AgentWakeSource,
    AgentWakeView,
    AgentWorkFallback,
} from "@modules/domain/agent-work"
import type { AgentWakeInbound } from "@modules/domain/agent-wake-rules"
import { AgentDirectoryService, AgentsService, InjectInstallations } from "@modules/domain/agents"
import type { Installation, InstallationDirectory } from "@modules/domain/agents"
import { threadKeyFor } from "@modules/integrations/openclaw"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectInboundAdapterRegistry, InjectInboundGraphBrief } from "./agent-inbound.decorators"
import { AgentInboundLogEvent } from "./agent-inbound.log-events"
import { eventPartsOf, trustOfWake, heldBy, offeredIn, skippedBy, triggerOfEvent } from "./inbound-turn.policy"
import type { InboundAdapter } from "./agent-inbound.contracts"
import type { InboundAdapterRegistry } from "./agent-inbound.port"

/** The language of the fixed lines of an event turn. */
const LOCALE = "vi"
/** The session every event turn of an agent shares, so its events are one thread for the runtime. */
const SESSION = "inbound"
/** The step key and node of the reply step. */
const REPLY = { stepKey: "final_reply", nodeKey: "intent_reply" } as const

/** Why a wake ends without a model turn. */
const NO_EVENT = "no_event"
const NO_CONTRACT = "no_contract"
const AGENT_INACTIVE = "agent_inactive"
const STALE = "stale"

/** What a turn needs of its event: the event the wake carries and the adapter that declared it. */
interface EventTurn {
    readonly inbound: AgentWakeInbound
    readonly adapter: InboundAdapter
}

/** Who the wake is for: the module, the instance and the name the agent acts under. */
interface EventAgent {
    readonly module: string
    readonly name: string
    readonly installation: Installation | null
}

@Injectable()
/**
 * The drain handler of every adapter that has none of its own: the contract pipeline. The event of the wake is the input (data, never an
 * instruction); the contracts the published version holds for its type and for the trust its trust gives are the only things the model may
 * pick; the reading is checked and handed to the door step the adapter declares. When the adapter declares a reply step the answer goes
 * through it, and when it declares none the run ends with no reply. An event no contract accepts ends the wake as skipped, visibly, and the
 * model is not called.
 */
export class InboundWorkHandlerService implements AgentWorkFallback, OnModuleInit {
    /** A fallback names its sources by `answers`. */
    readonly sources: ReadonlyArray<AgentWakeSource> = []

    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectInstallations() private readonly installations: InstallationDirectory,
        @InjectInboundGraphBrief() private readonly graph: AgentGraphBrief,
        private readonly handlers: AgentWorkHandlersService,
        @InjectInboundAdapterRegistry() private readonly registry: InboundAdapterRegistry,
        private readonly intents: IntentTurnService,
        private readonly pipeline: IntentPipelineService,
        private readonly turns: AgentTurnsService,
        private readonly runs: AgentRunsService,
        private readonly directory: AgentDirectoryService,
        private readonly agents: AgentsService,
        private readonly runtime: RuntimeAgentService,
    ) {}

    /** Registers the fallback with the drain once the app has started. */
    onModuleInit(): void {
        this.handlers.addFallback(this)
    }

    /** True for a registered adapter that is not one of the four built-in sources, which have handlers of their own. */
    answers(source: AgentWakeSource): boolean {
        return this.registry.lookup(source) !== undefined && !wakeSources.builtIn().includes(source)
    }

    /** Builds the turn from the event and the contracts, or ends the wake when there is no event, no contract or no live agent. */
    async prepare(turn: AgentTurnView): Promise<AgentTurnPrep> {
        const event = this.eventOf(turn)
        if (event === null) return this.ended(turn, NO_EVENT)
        const plan = await this.planOf(turn, event.inbound)
        if (plan === null) return this.ended(turn, NO_CONTRACT)
        const agent = await this.agentOf(turn)
        if (agent === null) return this.ended(turn, AGENT_INACTIVE)
        const runtimeAgentId = await this.runtime.agentFor(turn.workspaceId, agent.module, agent.installation)
        const identity = this.catalog.get("agentTurns.identity", { name: agent.name }, LOCALE)
        const planned = this.intents.planOf(plan, identity, eventPartsOf(event.inbound), LOCALE)
        await this.pipeline.open(turn, planned)
        return {
            kind: "run",
            plan: {
                module: agent.module,
                runtimeAgentId,
                threadKey: threadKeyFor(runtimeAgentId, SESSION),
                message: planned.prompt,
                timeoutMs: internalTimeoutMsOf(turn.source),
            },
        }
    }

    /** Reads the model's text against the contracts, acts through the adapter's door, and replies only when the adapter has a reply step. */
    async settle(turn: AgentTurnView, proposal: unknown, signal: AbortSignal): Promise<AgentHandlerEnding> {
        const event = this.eventOf(turn)
        if (event === null) return skippedBy(NO_EVENT)
        const plan = await this.planOf(turn, event.inbound)
        if (plan === null) return skippedBy(NO_CONTRACT)
        const agent = await this.agentOf(turn)
        if (agent === null) return skippedBy(AGENT_INACTIVE)
        if (!(await this.turns.touch(turn))) return skippedBy(STALE)
        const read = await this.pipeline.read(turn, plan, proposalTextOf(proposal), signal)
        const done = await this.pipeline.door(turn, event.adapter.doorStep, read, signal, {
            settle: {
                module: agent.module,
                actorName: agent.name,
                installationId: agent.installation?.id ?? null,
                locale: LOCALE,
            },
        })
        const { replyStep } = event.adapter
        const replied = replyStep === null ? false : await this.reply(turn, replyStep, done, signal, plan.trigger)
        return { status: "done", reason: null, outcome: { ...done, intent: read.trace, replied } }
    }

    /** A wake that cannot run is held with its reason on the Work tab; no line goes to anyone, since the core knows no channel of the adapter. */
    holdOver(wake: AgentWakeView, reason: string): Promise<AgentHandlerEnding> {
        this.logger.info(AgentInboundLogEvent.WakeEnded, { agentId: wake.agentId, wakeId: wake.wakeId, reason })
        return Promise.resolve(heldBy(reason))
    }

    private async reply(
        turn: AgentTurnView,
        kind: string,
        door: object,
        signal: AbortSignal,
        trigger: IntentTrigger,
    ): Promise<boolean> {
        const keys = await this.intents.nodeKeysOf(turn.workspaceId, turn.agentId, trigger, turn.source)
        await this.runs.runInline(
            turn.wakeId,
            {
                ...REPLY,
                nodeKey: keys.reply ?? REPLY.nodeKey,
                kind,
                effect: { kind: "pivot" },
                input: { wakeId: turn.wakeId, agentId: turn.agentId, workspaceId: turn.workspaceId, door },
            },
            signal,
        )
        return true
    }

    private eventOf(turn: AgentWakeView): EventTurn | null {
        const inbound = decodeInbound(turn.context.inbound)
        const adapter = this.registry.lookup(turn.source)
        return inbound === undefined || adapter === undefined ? null : { inbound, adapter }
    }

    private async planOf(turn: AgentWakeView, inbound: AgentWakeInbound): Promise<IntentPlan | null> {
        const trigger = triggerOfEvent(inbound.eventType)
        if (trigger === null) return null
        const trust = trustOfWake(inbound.trust)
        const found = await this.graph.contractsOf(turn.workspaceId, turn.agentId, trigger, trust, turn.source)
        if (found === null) return null
        const pinned = pinnedOf(turn.context)
        return { versionId: found.versionId, trigger, trust, pinned, contracts: offeredIn(found, pinned) }
    }

    private async agentOf(turn: AgentWakeView): Promise<EventAgent | null> {
        const facts = await this.directory.chatFactsOf(turn.workspaceId, turn.agentId)
        if (facts?.status !== "active") return null
        const [profile, installation] = await Promise.all([
            this.agents.profileOf(turn.workspaceId, turn.agentId),
            this.installations.ofAgent(turn.workspaceId, turn.agentId),
        ])
        return profile === null ? null : { module: facts.module, name: profile.name, installation }
    }

    private ended(turn: AgentTurnView, reason: string): AgentTurnPrep {
        this.logger.info(AgentInboundLogEvent.WakeEnded, { agentId: turn.agentId, wakeId: turn.wakeId, reason })
        return { kind: "end", ending: skippedBy(reason) }
    }
}
