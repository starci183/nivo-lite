import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/blocks-core"
import type { AgentWakeView } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** The effect a notice reaches the team through. */
const TEAM_POST: string = TOOL.teamMessagePost

/** Why no workflow took a wake: the agent has none yet, none of its workflows runs, or none of the running ones has a trigger for it. */
export type UntakenReason = "no_workflow" | "no_workflow_running" | "no_trigger_takes_wake"

/** The plain facts of a wake no workflow took. */
export interface UntakenWake {
    /** Why no workflow took it. */
    readonly reason: UntakenReason
    /** The workflows of the agent that run, by key (the primary one has none and is named by its sources). */
    readonly running: ReadonlyArray<string>
    /** The sources the running workflows are triggered by. */
    readonly sources: ReadonlyArray<string>
}

/** The language a wake names; Vietnamese when it names none the product speaks. */
const localeOfWake = (wake: AgentWakeView): "vi" | "en" => (Reflect.get(wake.context, "locale") === "en" ? "en" : "vi")

/** A text member of a wake's context, or a dash when it holds none. */
const memberOf = (wake: AgentWakeView, name: string): string => {
    const value: unknown = Reflect.get(wake.context, name)
    return typeof value === "string" && value !== "" ? value : "-"
}

@Injectable()
/**
 * What the engine tells the founder, in the agent's private chat with them, about a WAKE that no workflow could serve: a customer
 * line no workflow took (the agent has no workflow yet, no workflow runs, the channel is not among the triggers), or a wake that failed before any
 * step of a workflow existed. There is no step here, so no AI core to ask and no workflow to freeze: the engine says its own static
 * words with the plain facts (the channel, the conversation, why), once per wake, to the founder. The customer is told nothing: no
 * line to a customer is ever written in code.
 */
export class AgentGraphWakeNoticesService {
    constructor(
        private readonly nodes: GraphNodeRegistryService,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Tells the founder that a customer wake was taken by no workflow of the agent, with the facts. */
    async untaken(wake: AgentWakeView, facts: UntakenWake): Promise<void> {
        const locale = localeOfWake(wake)
        const why = this.catalog.get(`agentGraphs.wake.reason.${facts.reason}`, {}, locale)
        await this.tell(wake, "untaken", {
            title: this.catalog.get("agentGraphs.wake.untaken.title", {}, locale),
            text: this.catalog.get(
                "agentGraphs.wake.untaken.text",
                {
                    channel: memberOf(wake, "channel"),
                    conversation: memberOf(wake, "conversationId"),
                    why,
                    running: facts.running.length === 0 ? "-" : facts.running.join(", "),
                    sources: facts.sources.length === 0 ? "-" : facts.sources.join(", "),
                },
                locale,
            ),
        })
    }

    /** Tells the founder that a wake failed before any step of a workflow could run, with its code. */
    async failed(wake: AgentWakeView, code: string): Promise<void> {
        const locale = localeOfWake(wake)
        await this.tell(wake, `failed:${code}`, {
            title: this.catalog.get("agentGraphs.wake.failed.title", {}, locale),
            text: this.catalog.get(
                "agentGraphs.wake.failed.text",
                { channel: memberOf(wake, "channel"), conversation: memberOf(wake, "conversationId"), code },
                locale,
            ),
        })
    }

    /** One line to the founder, once per wake and kind; a team chat that cannot take it is logged, never thrown. */
    private async tell(wake: AgentWakeView, kind: string, words: { readonly title: string; readonly text: string }): Promise<void> {
        const post = this.nodes.optionalExecutorOf(TEAM_POST)
        const key = `wake-notice:${wake.wakeId}:${kind}`
        if (post === undefined) {
            this.logger.warn(AgentGraphsLogEvent.WakeNoticeSkipped, { agentId: wake.agentId, wakeId: wake.wakeId, kind })
            return
        }
        const turn: NodeTurn = {
            turnId: wake.wakeId,
            workspaceId: wake.workspaceId,
            agentId: wake.agentId,
            subject: null,
            conversationId: null,
            locale: localeOfWake(wake),
            origin: "system",
        }
        try {
            await post.execute(
                turn,
                { kind: "message.text", intent: "report", title: words.title, text: words.text, audience: "founder" },
                { key, dedupeKey: key },
            )
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.WakeNoticeSkipped, cause, { agentId: wake.agentId, wakeId: wake.wakeId, kind })
        }
    }
}
