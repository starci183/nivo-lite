import { Injectable, Optional, type OnModuleInit } from "@nestjs/common"
import { type EffectCall, type EffectPayload, isRefused, refusalOf, type EffectFact } from "@nivo-lite/agent-sdk/node"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import {
    agentMessageCodePayload,
    approvalDecisionCard,
    reportFactsKind,
    reportFactsPayload,
    workflowStoppedPayload,
    type AgentMessagePostPayload,
    type AgentMessagePreview,
    type ApprovalDecisionCard,
    type ReportFactsPayload,
    type TeamAudience,
    type TeamChatAnswer,
    type WorkflowStoppedPayload,
} from "@nivo-lite/agent-sdk/team-chat"
import { bankDisplayNameOf } from "@modules/domain/channel-connections"
import { GraphNodeRegistryService, type NodeTurn } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { InjectErrorReporter, isDomainError, type ErrorReporter } from "@modules/platform/errors"
import { InjectMessageCatalog, type MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { factWordsOf, withLineFactsOf, wordedStopFactsOf, type FactWords } from "./engine-facts.policy"
import { InjectTeamCardKinds, type TeamCardKinds } from "./team-chat.decorators"
import { lineKeyOf } from "./team-chat.policy"
import { CARD_KIND_NOT_POSTABLE, postedCardOf, type PostedCard } from "./team-card-post.policy"
import type { StopCardSection, StopCardSectionGiven } from "./stop-card.contracts"
import {
    countedSectionOf,
    givenSectionOf,
    resolvedSectionOf,
    stopIntentOf,
    storedSectionOf,
    typedPayloadOf,
} from "./stop-card.policy"
import { stopCardSectionGiven } from "./stop-card.schema"
import type { TeamCardMessage } from "./team-chat-audience.contracts"
import { TeamChatAudienceService } from "./team-chat-audience.service"
import { TeamChatCardsService } from "./team-chat-cards.service"
import { TeamChatStoreService } from "./team-chat-store.service"
import { TeamChatError, TeamChatErrorCode } from "./errors/team-chat.error"
import { TeamChatLogEvent } from "./team-chat.log-events"

/** The code of a failed team post: a domain error's own code, else what it is. */
const codeOf = (cause: unknown): string => {
    if (isDomainError(cause)) return cause.code
    return cause instanceof Error ? cause.name : "unknown"
}

/** Who a line is for when the caller does not say: the room of the agent's own team. */
const DEFAULT_AUDIENCE: TeamAudience = "own"

/** The kind of the card of a stopped workflow: the engine's own, built here and never by a tool call. */
const STOPPED_KIND = "workflow.stopped"

/** The kind of the engine's own report with facts (NIVO speaks): built by the engine only, never by a tool call. */
const REPORT_FACTS_KIND: string = reportFactsKind.id

/** What the engine hands over for its report: the heading, the readable sentence and the facts, for whom. */
interface ReportGiven {
    readonly title: string
    readonly audience: TeamAudience
    readonly payload: ReportFactsPayload
}

/** Who reads an engine report: the audience the engine names, else the founder alone. */
const reportAudienceOf = (audience: unknown): TeamAudience =>
    audience === "own" || audience === "everyone" ? audience : "founder"

const reportGivenOf = (payload: EffectPayload): ReportGiven | null => {
    const content = reportFactsPayload.safeParse({ text: payload["text"], facts: payload["facts"] })
    const { title, audience } = payload
    return content.success && typeof title === "string" && title !== ""
        ? {
              title,
              audience: reportAudienceOf(audience),
              payload: content.data,
          }
        : null
}

/** What the engine hands over for the card of a stopped step: its heading, the readable line, the content, and its typed part (threads). */
interface StoppedGiven {
    readonly title: string
    readonly summary: string
    readonly card: WorkflowStoppedPayload
    readonly section: StopCardSectionGiven | null
}

/** What the engine hands over when the stop of a thread changed state: the heading and line of that state, and the typed part. */
interface RewriteGiven {
    readonly title: string
    readonly summary: string
    readonly stop: StopCardSectionGiven
    /** What the stop's record says now about its holding line to the customer (its raw line facts); empty when it says nothing. */
    readonly lineFacts: ReadonlyArray<{ readonly name: string; readonly value: string }>
}

/** The raw facts handed with a rewrite: every `{ name, value }` pair of strings; anything else is left out. */
const rawFactsOf = (given: unknown): RewriteGiven["lineFacts"] =>
    Array.isArray(given)
        ? given.flatMap((one: unknown) => {
              if (typeof one !== "object" || one === null) return []
              const name: unknown = Reflect.get(one, "name")
              const value: unknown = Reflect.get(one, "value")
              return typeof name === "string" && typeof value === "string" ? [{ name, value }] : []
          })
        : []

const rewriteGivenOf = (payload: EffectPayload): RewriteGiven | null => {
    const rewrite: unknown = payload["rewrite"]
    if (typeof rewrite !== "object" || rewrite === null) return null
    const title: unknown = Reflect.get(rewrite, "title")
    const summary: unknown = Reflect.get(rewrite, "summary")
    const stop = stopCardSectionGiven.safeParse(Reflect.get(rewrite, "stop"))
    return typeof title === "string" && typeof summary === "string" && stop.success
        ? { title, summary, stop: stop.data, lineFacts: rawFactsOf(Reflect.get(rewrite, "lineFacts")) }
        : null
}

/** What the engine hands over when a stopped step's run went on and ended well: the heading and line of the resolved card, and when. */
interface ResolvedGiven {
    readonly title: string
    readonly summary: string
    readonly at: string
}

const resolvedGivenOf = (payload: EffectPayload): ResolvedGiven | null => {
    const resolved: unknown = payload["resolved"]
    if (typeof resolved !== "object" || resolved === null) return null
    const title: unknown = Reflect.get(resolved, "title")
    const summary: unknown = Reflect.get(resolved, "summary")
    const at: unknown = Reflect.get(resolved, "at")
    return typeof title === "string" && typeof summary === "string" && typeof at === "string"
        ? { title, summary, at }
        : null
}

/**
 * A package preview kept only when its kind is one a package registered and its payload passes that kind's schema; otherwise
 * undefined (the preview is dropped, the card still posts).
 */
const checkedPreviewOf = (
    preview: AgentMessagePreview | undefined,
    kinds: TeamCardKinds,
): AgentMessagePreview | undefined =>
    preview !== undefined && kinds(preview.kind)?.payload.safeParse(preview.payload).success === true
        ? preview
        : undefined

/** An approval card with its package preview checked against its kind. */
const decisionCheckedOf = (card: ApprovalDecisionCard, kinds: TeamCardKinds): ApprovalDecisionCard => {
    const { preview, ...rest } = card
    const shown = checkedPreviewOf(preview, kinds)
    return shown === undefined ? rest : { ...rest, preview: shown }
}

/**
 * The stop card the engine handed, with the approval card of a permission request (`decision`, the `approval.decision` card built
 * before the write) carried on it, and every package preview checked against its kind.
 */
const stoppedGivenOf = (payload: EffectPayload, kinds: TeamCardKinds): StoppedGiven | null => {
    const card = workflowStoppedPayload.safeParse(payload["card"])
    const { title, summary } = payload
    if (!card.success || typeof title !== "string" || typeof summary !== "string") return null
    const { preview, decision: _carried, ...common } = card.data
    const shown = checkedPreviewOf(preview, kinds)
    const asked = approvalDecisionCard.safeParse(payload["decision"])
    const decision = asked.success ? decisionCheckedOf(asked.data, kinds) : undefined
    return {
        title,
        summary,
        card: {
            ...common,
            ...(shown === undefined ? {} : { preview: shown }),
            ...(decision === undefined ? {} : { decision }),
        },
        section: givenSectionOf(payload["card"]),
    }
}

/** The one-tap replies of a stop card: the AI's suggestions while it is open, none after. */
const stopOptionsOf = (
    card: WorkflowStoppedPayload,
    section: StopCardSection | null,
): ReadonlyArray<{ readonly id: string; readonly label: string }> =>
    section !== null && section.state !== "open"
        ? []
        : card.suggestions.map((one, index) => ({ id: String(index), label: one.text }))

/** The card of the same stopped step stopping again: the first stop's time kept, one more repeat, the new words and the later time. */
const foldedOf = (now: WorkflowStoppedPayload, before: WorkflowStoppedPayload): WorkflowStoppedPayload => ({
    ...now,
    repeats: before.repeats + 1,
    firstAt: before.firstAt,
})

/**
 * The card of ONE stop told twice (the AI core worded it, then the engine told the same stop once its customer was frozen): the words
 * already in the chat stay, and the freeze decisions the later telling carries are added, so the one card names the ways on.
 */
export const sameStopOf = (now: WorkflowStoppedPayload, before: WorkflowStoppedPayload): WorkflowStoppedPayload =>
    now.decisions.length === 0 ? before : { ...before, decisions: now.decisions }

/**
 * The common content of a stop's card against the card already stored: a first telling as given; the same occurrence told again keeps
 * the words in the chat and takes the decisions it brings; a new occurrence folds in (one more repeat, the first time kept).
 */
const commonCardOf = (
    given: WorkflowStoppedPayload,
    before: WorkflowStoppedPayload | null,
    sameOccurrence: boolean,
): WorkflowStoppedPayload => {
    if (before === null) return given
    return sameOccurrence ? sameStopOf(given, before) : foldedOf(given, before)
}

/**
 * The message of a stop's card to post or fold. The same stop told again keeps the words already in the chat (its title and summary
 * too) unless it is a thread's typed stop, whose words follow its state; a stop of a thread carries its typed part (state, needs and
 * replies), counted one write more than the stored one.
 */
const stoppedMessageOf = (
    given: StoppedGiven,
    previous: TeamCardMessage | null,
    occurrence: string,
): TeamCardMessage => {
    const parsed = previous === null ? null : workflowStoppedPayload.safeParse(previous.payload)
    const before = parsed?.success === true ? parsed.data : null
    const kept = before !== null && previous?.occurrence === occurrence ? previous : null
    const common = commonCardOf(given.card, before, kept !== null)
    const section = given.section === null ? null : countedSectionOf(given.section, storedSectionOf(previous?.payload))
    const card = section === null ? common : typedPayloadOf(common, section)
    const words = kept !== null && section === null ? kept : given
    return {
        kind: STOPPED_KIND,
        intent: section === null ? "ask" : stopIntentOf(section),
        title: words.title,
        summary: words.summary,
        payload: card,
        options: stopOptionsOf(card, section),
        occurrence,
    }
}

/** The repeats of a stop card message built here (its payload is always a stop card). */
const repeatsOf = (message: TeamCardMessage): number => {
    const repeats: unknown =
        typeof message.payload === "object" && message.payload !== null ? Reflect.get(message.payload, "repeats") : null
    return typeof repeats === "number" ? repeats : 1
}

@Injectable()
/**
 * The executor of the team-post tool (`TOOL.teamMessagePost`): a step's agent tells the team something. A card (an order, a payment) is
 * built by the package's own step from its records and posted finished; the engine only checks its content against the schema of the kind
 * a plugin registered (`INSTALLED.messageKindOf`) and stores and delivers it as it is, knowing no shape of any package's card. The line
 * always reaches the founder's direct room, and also the agent's team room (`own`, the default) or the common room (`everyone`) when
 * the agent holds the right to post there; the facts list the rooms posted to and what was skipped and why, and a missing room or right
 * never refuses. Once per key: a retry of the same call finds the lines it wrote. A kind no plugin registers, or content that is not of
 * its kind's shape, is a refusal fact; a line
 * that cannot be written (the agent or the owner is not of the workspace) fails the step, so a run never reports done for a message
 * nobody received.
 */
export class AgentMessagePostExecutorService implements OnModuleInit {
    constructor(
        private readonly audience: TeamChatAudienceService,
        private readonly store: TeamChatStoreService,
        private readonly cards: TeamChatCardsService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
        @Optional() @InjectMessageCatalog() private readonly catalog?: MessageCatalog,
        @Optional() @InjectTeamCardKinds() private readonly cardKinds: TeamCardKinds = INSTALLED.messageKindOf,
        @Optional() @InjectErrorReporter() private readonly errors?: ErrorReporter,
        @Optional() @InjectLogger() private readonly logger?: Logger,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.teamMessagePost,
            execute: (turn, payload, call) => this.told(turn, call, () => this.post(turn, payload, call)),
        })
    }

    /**
     * A post to the team chat that is refused (a refusal fact) or fails (a throw) is NEVER silent (ruling R45): the team chat is where the
     * engine tells people, so its own failure is told elsewhere, once: an app error (the team console) and one log line. Nothing is posted
     * about it (no recursion). The step still gets the same answer: the refusal fact, or the throw.
     */
    private async told(turn: NodeTurn, call: EffectCall, post: () => Promise<EffectFact>): Promise<EffectFact> {
        try {
            const fact = await post()
            if (isRefused(fact)) await this.recorded(turn, call, fact.id, null)
            return fact
        } catch (cause) {
            await this.recorded(turn, call, codeOf(cause), cause)
            throw cause
        }
    }

    /** Records one refused or failed team post: the log line, then the app error (which never throws). */
    private async recorded(turn: NodeTurn, call: EffectCall, code: string, cause: unknown): Promise<void> {
        const facts = { workspaceId: turn.workspaceId, agentId: turn.agentId, runId: turn.turnId, code, key: call.key }
        this.logger?.warn(TeamChatLogEvent.PostRefused, facts)
        await this.errors?.report(
            TeamChatLogEvent.PostRefused,
            cause ?? new TeamChatError({ code: TeamChatErrorCode.AgentMessageNotPosted, params: { refusal: code } }),
            facts,
        )
    }

    private async post(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        // The engine's own card (never reachable from a model's tool call, whose payload the runner checks against the tool's schema).
        if (payload["kind"] === STOPPED_KIND) return this.stopped(turn, payload, call)
        if (payload["kind"] === REPORT_FACTS_KIND) return this.reported(turn, payload, call)
        const parsed = agentMessageCodePayload.safeParse(payload)
        if (!parsed.success) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
        if ("messageId" in parsed.data) return this.answered(turn, parsed.data, call)
        const built = this.built(parsed.data)
        if ("refused" in built) return refusalOf(built.refused)
        const posted = await this.audience.postTeamCard(turn.workspaceId, {
            agentId: turn.agentId,
            audience: parsed.data.audience ?? DEFAULT_AUDIENCE,
            message: built.message,
            key: lineKeyOf(call.dedupeKey ?? call.key),
        })
        return { kind: "chat-message", id: posted.messageId, facts: { messageId: posted.messageId, ...posted.facts } }
    }

    /**
     * The card of a stopped workflow, built by the engine: once per stuck step, so the same step of the same run stopping again folds
     * into the card already in the chat (one more repeat, a later `lastAt`) under the same key, which keeps a founder's reply to it
     * resuming the step. A retry of the same occurrence changes nothing but the freeze decisions it may bring (`sameStopOf`).
     */
    private async stopped(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        const rewrite = rewriteGivenOf(payload)
        if (rewrite !== null) return this.rewrittenStop(turn, rewrite, lineKeyOf(call.dedupeKey ?? call.key))
        const resolved = resolvedGivenOf(payload)
        if (resolved !== null) return this.resolvedStop(turn, resolved, lineKeyOf(call.dedupeKey ?? call.key))
        const raw = stoppedGivenOf(payload, this.cardKinds)
        if (raw === null) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
        const given = raw.section === null ? raw : this.wordedStop(raw, turn)
        const key = lineKeyOf(call.dedupeKey ?? call.key)
        const previous = await this.audience.storedCard(turn.workspaceId, key)
        const message = stoppedMessageOf(given, previous, call.key)
        const folded = previous === null ? null : await this.audience.foldTeamCard(turn.workspaceId, key, message)
        if (folded !== null)
            return { kind: "chat-message", id: folded, facts: { folded: true, repeats: repeatsOf(message) } }
        const posted = await this.audience.postTeamCard(turn.workspaceId, {
            agentId: turn.agentId,
            audience: DEFAULT_AUDIENCE,
            message,
            key,
        })
        return { kind: "chat-message", id: posted.messageId, facts: posted.facts }
    }

    /** The words the facts of an engine message are worded with, in the turn's language (labels fall back to their keys with no catalogue). */
    private factWords(turn: NodeTurn): FactWords {
        const locale = turn.locale === "en" ? "en" : "vi"
        return this.catalog === undefined
            ? { text: () => "", bankName: bankDisplayNameOf }
            : factWordsOf({ catalog: this.catalog, locale, bankName: bankDisplayNameOf })
    }

    /**
     * The card of a thread's typed stop with its facts in words (`wordedStopFactsOf`): the workflow and step by their titles, the code by
     * its common words, a bank by its name; every raw value only as a `technical` fact. An old-engine card is never passed here.
     */
    private wordedStop(given: StoppedGiven, turn: NodeTurn): StoppedGiven {
        const facts = wordedStopFactsOf(
            given.card.facts,
            {
                workflowTitle: given.card.workflow.title,
                stepTitle: given.card.step.title,
                question: given.card.question,
                locale: turn.locale === "en" ? "en" : "vi",
            },
            this.factWords(turn),
        )
        return { ...given, card: { ...given.card, facts } }
    }

    /**
     * The engine's own report with facts (`report.facts`): one readable sentence and its facts, posted once per key to the founder (or
     * the audience the engine names). A model's `nivo.tool.team.message.post` can never name this kind (its payload is checked against the tool's
     * schema before it reaches here).
     */
    private async reported(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        const given = reportGivenOf(payload)
        if (given === null) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
        const posted = await this.audience.postTeamCard(turn.workspaceId, {
            agentId: turn.agentId,
            audience: given.audience,
            message: {
                kind: REPORT_FACTS_KIND,
                intent: "report",
                title: given.title,
                summary: given.payload.text,
                payload: given.payload,
            },
            key: lineKeyOf(call.dedupeKey ?? call.key),
        })
        return { kind: "chat-message", id: posted.messageId, facts: posted.facts }
    }

    /**
     * The card of a stop whose run went on and ended well, rewritten in place under the same key: the same content, marked resolved,
     * asking nothing (no reply options, no decisions), so the room keeps no stale ask. A stop that posted no card changes nothing and
     * nothing is posted.
     */
    private async resolvedStop(turn: NodeTurn, resolved: ResolvedGiven, key: string): Promise<EffectFact> {
        const previous = await this.audience.storedCard(turn.workspaceId, key)
        const before = previous === null ? null : workflowStoppedPayload.safeParse(previous.payload)
        if (before?.success !== true) return { kind: "chat-message", id: key, facts: { resolved: false } }
        // A typed card resolved this way keeps its typed part, resolved too (the replies stay).
        const typed = storedSectionOf(previous?.payload)
        const message: TeamCardMessage = {
            kind: STOPPED_KIND,
            intent: "notify",
            title: resolved.title,
            summary: resolved.summary,
            payload: {
                ...before.data,
                suggestions: [],
                decisions: [],
                resolvedAt: resolved.at,
                ...(typed === null ? {} : { stop: resolvedSectionOf(typed, resolved.at) }),
            },
            options: [],
            ...(previous?.occurrence === undefined ? {} : { occurrence: previous.occurrence }),
        }
        const folded = await this.audience.foldTeamCard(turn.workspaceId, key, message)
        return { kind: "chat-message", id: folded ?? key, facts: { resolved: folded !== null } }
    }

    /**
     * The card of a thread's stop whose state changed (answered, taken over, skipped, timed out, resolved), rewritten in place under the
     * same key: the common content as stored, the heading and line of the new state, the asks of that state and the typed part with the
     * founder's replies. Never a second card: a stop that posted none changes nothing and nothing is posted.
     */
    private async rewrittenStop(turn: NodeTurn, rewrite: RewriteGiven, key: string): Promise<EffectFact> {
        const previous = await this.audience.storedCard(turn.workspaceId, key)
        const before = previous === null ? null : workflowStoppedPayload.safeParse(previous.payload)
        if (previous === null || before?.success !== true)
            return { kind: "chat-message", id: key, facts: { rewritten: false } }
        const section = countedSectionOf(rewrite.stop, storedSectionOf(previous.payload))
        // What the stop says now about its holding line to the customer (not told, and why) is shown on the card, in words.
        const facts = withLineFactsOf(before.data.facts, rewrite.lineFacts, this.factWords(turn))
        const card = typedPayloadOf({ ...before.data, facts: [...facts] }, section)
        const message: TeamCardMessage = {
            kind: STOPPED_KIND,
            intent: stopIntentOf(section),
            title: rewrite.title,
            summary: rewrite.summary,
            payload: card,
            options: stopOptionsOf(card, section),
            ...(previous.occurrence === undefined ? {} : { occurrence: previous.occurrence }),
        }
        const folded = await this.audience.foldTeamCard(turn.workspaceId, key, message)
        return {
            kind: "chat-message",
            id: folded ?? key,
            facts: { rewritten: folded !== null, state: section.state, revision: section.revision },
        }
    }

    /**
     * An agent's answer to a person in the team chat (the `team.chat` step): posted in the room of the person's message as a reply to
     * it, as a typed `message.text` (intent notify), once per message and agent (the call's dedupe key). Refused (a fact, never a post)
     * when the message is not a PERSON's line, or not of the room the run is about (`turn.subject` = `chat-room:<id>`).
     */
    private async answered(turn: NodeTurn, given: TeamChatAnswer, call: EffectCall): Promise<EffectFact> {
        const [asked] = await this.store.messagesByIds(turn.workspaceId, [given.messageId])
        if (asked?.authorKind !== "user") return refusalOf("not_person_line")
        if (turn.subject?.kind !== "chat-room" || turn.subject.id !== asked.roomId) return refusalOf("other_room")
        const posted = await this.cards.postMessage(turn.workspaceId, {
            authorAgentId: turn.agentId,
            roomId: asked.roomId,
            toUserId: null,
            body: given.text,
            key: lineKeyOf(call.dedupeKey ?? call.key),
            replyTo: asked.id,
            agentMessage: JSON.stringify({
                kind: "message.text",
                intent: "notify",
                title: "",
                summary: given.text,
                payload: { text: given.text },
            }),
        })
        if (posted === null) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
        return {
            kind: "chat-message",
            id: posted.messageId,
            facts: { messageId: posted.messageId, roomId: posted.roomId, replyTo: asked.id },
        }
    }

    /** The message of a payload: the caller's words, or the finished card of a registered kind. */
    private built(given: AgentMessagePostPayload): PostedCard {
        if ("payload" in given) return postedCardOf(given, this.cardKinds(given.kind))
        if (given.kind !== "message.text") return { refused: CARD_KIND_NOT_POSTABLE }
        return {
            message: {
                kind: given.kind,
                intent: given.intent,
                title: given.title,
                summary: given.text,
                payload: { text: given.text },
            },
        }
    }
}
