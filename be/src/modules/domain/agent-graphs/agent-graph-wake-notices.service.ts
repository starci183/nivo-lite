import { Injectable } from "@nestjs/common"
import { TOOL, reportFactsKind, type MessageFact } from "@nivo-lite/blocks-core"
import type { AgentWakeView } from "@modules/domain/agent-work"
import { bankDisplayNameOf } from "@modules/domain/channel-connections"
import { channelFactOf, codeFactsOf, factWordsOf, wordOr, type FactWords } from "@modules/domain/team-chat"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
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

/** A text member of a wake's context, or null when it holds none. */
const memberOf = (wake: AgentWakeView, name: string): string | null => {
    const value: unknown = Reflect.get(wake.context, name)
    return typeof value === "string" && value !== "" ? value : null
}

/** What a report of a wake says: its heading, one readable sentence (no code, no id in it) and its facts. */
interface WakeReport {
    readonly title: string
    readonly text: string
    readonly facts: ReadonlyArray<MessageFact>
}

/** The fact of a raw value, folded under the technical details. */
const technicalOf = (words: FactWords, label: string, value: string): MessageFact => ({
    name: wordOr(words, `teamChat.fact.${label}`, label),
    value,
    technical: true,
})

/** The facts every wake report carries: the channel in words (when it names one); the conversation id last, as a technical fact. */
const wakeFactsOf = (
    wake: AgentWakeView,
    words: FactWords,
    middle: ReadonlyArray<MessageFact>,
): ReadonlyArray<MessageFact> => {
    const channel = memberOf(wake, "channel")
    const conversation = memberOf(wake, "conversationId")
    const all = [
        ...(channel === null ? [] : [channelFactOf(words, channel)]),
        ...middle,
        ...(conversation === null ? [] : [technicalOf(words, "conversation", conversation)]),
    ]
    return [...all.filter((fact) => fact.technical !== true), ...all.filter((fact) => fact.technical === true)]
}

/** The sources of the running workflows: their channel names in words when every one has a name, else the raw ids as a technical fact. */
const sourcesFactOf = (words: FactWords, sources: ReadonlyArray<string>): MessageFact | null => {
    if (sources.length === 0) return null
    const names = sources.map((source) => words.text(`teamChat.channel.${source}`))
    const known = names.filter((name) => name !== "")
    return known.length === names.length
        ? { name: wordOr(words, "teamChat.fact.sources", "sources"), value: known.join(", "), technical: false }
        : technicalOf(words, "sources", sources.join(", "))
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

    /**
     * Tells the founder that a customer wake was taken by no workflow of the agent: one readable sentence, then the facts (the channel,
     * why, the sources the running workflows take; the running workflow keys and the conversation id as technical facts).
     */
    async untaken(wake: AgentWakeView, facts: UntakenWake): Promise<void> {
        const locale = localeOfWake(wake)
        const words = factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
        const why: MessageFact = {
            name: wordOr(words, "teamChat.fact.why", "why"),
            value: this.catalog.get(`agentGraphs.wake.reason.${facts.reason}`, {}, locale),
            technical: false,
        }
        const sources = sourcesFactOf(words, facts.sources)
        const middle = [
            why,
            ...(sources === null ? [] : [sources]),
            ...(facts.running.length === 0 ? [] : [technicalOf(words, "running", facts.running.join(", "))]),
        ]
        await this.tell(wake, "untaken", {
            title: this.catalog.get("agentGraphs.wake.untaken.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.untaken.sentence", {}, locale),
            facts: wakeFactsOf(wake, words, middle),
        })
    }

    /**
     * Tells the founder that a wake failed before any step of a workflow could run: one readable sentence, then the facts (the channel,
     * the reason in the common words of its code; the code and the conversation id as technical facts).
     */
    async failed(wake: AgentWakeView, code: string): Promise<void> {
        const locale = localeOfWake(wake)
        const words = factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
        await this.tell(wake, `failed:${code}`, {
            title: this.catalog.get("agentGraphs.wake.failed.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.failed.sentence", {}, locale),
            facts: wakeFactsOf(wake, words, codeFactsOf(words, code)),
        })
    }

    /** One typed report (`report.facts`) to the founder, once per wake and kind; a team chat that cannot take it is logged, never thrown. */
    private async tell(wake: AgentWakeView, kind: string, report: WakeReport): Promise<void> {
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
                {
                    kind: reportFactsKind.id,
                    title: report.title,
                    text: report.text,
                    facts: report.facts.map((fact) => ({ ...fact })),
                    audience: "founder",
                },
                { key, dedupeKey: key },
            )
        } catch (cause) {
            this.logger.error(AgentGraphsLogEvent.WakeNoticeSkipped, cause, { agentId: wake.agentId, wakeId: wake.wakeId, kind })
        }
    }
}
