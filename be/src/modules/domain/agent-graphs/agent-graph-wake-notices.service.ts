import { Injectable } from "@nestjs/common"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import { reportFactsKind, type MessageFact } from "@nivo-lite/agent-sdk/team-chat"
import type { AgentWakeView } from "@modules/domain/agent-work"
import { bankDisplayNameOf } from "@modules/domain/channel-connections"
import { channelFactOf, codeFactsOf, factWordsOf, wordOr, type FactWords } from "@modules/domain/team-chat"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

/** The effect a notice reaches the team through. */
const TEAM_POST: string = TOOL.teamMessagePost

/** The code of a wake that names no trigger verb. */
const UNROUTABLE_CODE = "no_trigger_verb"

/**
 * Why no workflow took a wake: the agent's setup was never applied (it does not answer customers until it is), the agent has no
 * workflow yet, none of its workflows runs, or none of the running ones has a trigger for it.
 */
export type UntakenReason = "setup_not_applied" | "no_workflow" | "no_workflow_running" | "no_trigger_takes_wake"

/** The plain facts of a wake no workflow took. */
export interface UntakenWake {
    /** Why no workflow took it. */
    readonly reason: UntakenReason
    /** The workflows of the agent that run, by key (the primary one has none and is named by its sources). */
    readonly running: ReadonlyArray<string>
    /** The sources the running workflows are triggered by. */
    readonly sources: ReadonlyArray<string>
}

/** The plain facts of a hand-off the engine refused: the code, the workflow it named and the providers that workflow waits for. */
export interface RefusedWake {
    /** The refusal code (`call_target_hidden`). */
    readonly code: string
    /** The name of the workflow the hand-off named. */
    readonly workflow: string
    /** The providers that workflow waits for, distinct. */
    readonly waitingFor: ReadonlyArray<string>
}

/**
 * The plain facts of a wake the engine GAVE UP on (DEF-5): dead past its attempts, or a call ended because the run it would wait behind
 * handed its event back. The subject (contact, route) comes from the wake itself.
 */
export interface LostWake {
    /** Why it was given up (`attempts`, `call_handed_back`). */
    readonly code: string
    /** The workflow it was for (its key), or null when it names none. */
    readonly workflow: string | null
    /** The run it would have waited behind, or null. */
    readonly heldBy: string | null
    /** The id of the event it carried (the key its intake stored it under, else the event's id), or null. */
    readonly event: string | null
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
     * why, the sources the running workflows take; the running workflow keys and the conversation id as technical facts). A wake that
     * names its conversation is told ONCE PER CONVERSATION and reason, however many lines the customer writes: every later line ends
     * the same way and adds no report. A wake of no conversation is told once per wake.
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
        const conversation = memberOf(wake, "conversationId")
        const report = {
            title: this.catalog.get("agentGraphs.wake.untaken.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.untaken.sentence", {}, locale),
            facts: wakeFactsOf(wake, words, middle),
        }
        const once = conversation === null ? null : `wake-notice:conversation:${conversation}:untaken:${facts.reason}`
        await this.tell(wake, "untaken", report, once)
    }

    /**
     * Tells the founder, once per wake, that a wake named no event any workflow listens for (its producer wrote no trigger verb), so
     * nothing ran: one readable sentence, then the facts (the channel when it names one, why in words; the code and the conversation id
     * as technical facts).
     */
    async unroutable(wake: AgentWakeView): Promise<void> {
        const locale = localeOfWake(wake)
        const words = factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
        const middle: ReadonlyArray<MessageFact> = [
            {
                name: wordOr(words, "teamChat.fact.why", "why"),
                value: this.catalog.get(`agentGraphs.wake.reason.${UNROUTABLE_CODE}`, {}, locale),
                technical: false,
            },
            technicalOf(words, "code", UNROUTABLE_CODE),
        ]
        await this.tell(wake, "unroutable", {
            title: this.catalog.get("agentGraphs.wake.unroutable.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.unroutable.sentence", {}, locale),
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

    /**
     * Tells the founder, once per wake and reason, that the engine GAVE UP on a wake before any step ran (DEF-5: never a silent death):
     * one readable sentence (no workflow handled it: the team must), then the facts: why in words, the workflow it was for, the subject
     * and the event's id, the run it would have waited behind and the code as technical facts, the channel and the route.
     */
    async lost(wake: AgentWakeView, facts: LostWake): Promise<void> {
        const locale = localeOfWake(wake)
        const words = factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
        const contact = memberOf(wake, "contactId")
        const middle: ReadonlyArray<MessageFact> = [
            {
                name: wordOr(words, "teamChat.fact.why", "why"),
                value: this.catalog.get(`agentGraphs.wake.reason.${facts.code}`, {}, locale),
                technical: false,
            },
            ...(facts.workflow === null
                ? []
                : [{ name: wordOr(words, "teamChat.fact.workflow", "workflow"), value: facts.workflow, technical: false }]),
            ...(contact === null ? [] : [technicalOf(words, "customer", contact)]),
            ...(facts.event === null ? [] : [technicalOf(words, "event", facts.event)]),
            ...(facts.heldBy === null ? [] : [technicalOf(words, "run", facts.heldBy)]),
            technicalOf(words, "code", facts.code),
        ]
        await this.tell(wake, `lost:${facts.code}`, {
            title: this.catalog.get("agentGraphs.wake.lost.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.lost.sentence", {}, locale),
            facts: wakeFactsOf(wake, words, middle),
        })
    }

    /**
     * Tells the founder that a hand-off was refused before any step ran (its target workflow is switched on but not ready): one readable
     * sentence, then the facts (the workflow it named, why, the providers it waits for; the code as a technical fact). Told once per wake.
     */
    async refused(wake: AgentWakeView, facts: RefusedWake): Promise<void> {
        const locale = localeOfWake(wake)
        const words = factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
        const middle: ReadonlyArray<MessageFact> = [
            { name: wordOr(words, "teamChat.fact.workflow", "workflow"), value: facts.workflow, technical: false },
            {
                name: wordOr(words, "teamChat.fact.why", "why"),
                value: this.catalog.get(`agentGraphs.wake.reason.${facts.code}`, {}, locale),
                technical: false,
            },
            {
                name: wordOr(words, "agentGraphs.wake.fact.waitingFor", "waitingFor"),
                value: facts.waitingFor.join(", "),
                technical: false,
            },
            technicalOf(words, "code", facts.code),
        ]
        await this.tell(wake, `refused:${facts.code}`, {
            title: this.catalog.get("agentGraphs.wake.refused.title", {}, locale),
            text: this.catalog.get("agentGraphs.wake.refused.sentence", {}, locale),
            facts: wakeFactsOf(wake, words, middle),
        })
    }

    /**
     * One typed report (`report.facts`) to the founder, once per `once` when the caller names what it is told once for, else once per
     * wake and kind; a team chat that cannot take it is logged, never thrown.
     */
    private async tell(
        wake: AgentWakeView,
        kind: string,
        report: WakeReport,
        once: string | null = null,
    ): Promise<void> {
        const post = this.nodes.optionalExecutorOf(TEAM_POST)
        const key = once ?? `wake-notice:${wake.wakeId}:${kind}`
        if (post === undefined) {
            this.logger.warn(AgentGraphsLogEvent.WakeNoticeSkipped, {
                agentId: wake.agentId,
                wakeId: wake.wakeId,
                kind,
            })
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
            this.logger.error(AgentGraphsLogEvent.WakeNoticeSkipped, cause, {
                agentId: wake.agentId,
                wakeId: wake.wakeId,
                kind,
            })
        }
    }
}
