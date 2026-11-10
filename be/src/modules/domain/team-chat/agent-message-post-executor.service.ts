import { Injectable, Optional } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EffectCall, EffectPayload, NodeQuery } from "@nivo-lite/agent-sdk/node"
import {
    TOOL,
    agentMessagePostEffect,
    orderAddressOf,
    refusalOf,
    teamOrderCardOf,
    teamPaymentCardOf,
    workflowStoppedPayload,
} from "@nivo-lite/blocks-core"
import type {
    AgentMessagePostPayload,
    CardOrder,
    EffectFact,
    TeamAudience,
    WorkflowStoppedPayload,
} from "@nivo-lite/blocks-core"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeRow, NodeTurn } from "@modules/domain/graph-nodes"
import { lineKeyOf } from "./team-chat.policy"
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
import { TeamChatError, TeamChatErrorCode } from "./errors/team-chat.error"

/** The most catalogue items read to find the photos of a card. */
const CATALOGUE_ROWS = 500

/** Who a line is for when the caller does not say: the room of the agent's own team. */
const DEFAULT_AUDIENCE: TeamAudience = "own"

/** The message to store, or why none can be built. */
type Built = { readonly message: TeamCardMessage } | { readonly refused: string }

/** The kind of the card of a stopped workflow: the engine's own, built here and never by a tool call. */
const STOPPED_KIND = "workflow.stopped"

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
}

const rewriteGivenOf = (payload: EffectPayload): RewriteGiven | null => {
    const rewrite: unknown = payload["rewrite"]
    if (typeof rewrite !== "object" || rewrite === null) return null
    const title: unknown = Reflect.get(rewrite, "title")
    const summary: unknown = Reflect.get(rewrite, "summary")
    const stop = stopCardSectionGiven.safeParse(Reflect.get(rewrite, "stop"))
    return typeof title === "string" && typeof summary === "string" && stop.success
        ? { title, summary, stop: stop.data }
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

const stoppedGivenOf = (payload: EffectPayload): StoppedGiven | null => {
    const card = workflowStoppedPayload.safeParse(payload["card"])
    const { title, summary } = payload
    return card.success && typeof title === "string" && typeof summary === "string"
        ? { title, summary, card: card.data, section: givenSectionOf(payload["card"]) }
        : null
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

/** A text member of a row, or empty. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** The order of a row as a card reads it, or null when the row has no order number. */
const cardOrderOf = (row: NodeRow | undefined): CardOrder | null =>
    typeof row?.orderNo === "string"
        ? {
              orderNo: row.orderNo,
              amountVnd: typeof row.amountVnd === "number" ? row.amountVnd : null,
              items: row.items,
              note: orderAddressOf(row),
          }
        : null

@Injectable()
/**
 * The executor of the team-post tool (`TOOL.teamMessagePost`): a step's agent tells the team something. A card about an order or a
 * payment is built here from the records the caller names by id (the order, its customer, the catalogue photos, the bank credit that
 * paid it), so no line, price or total on a card is ever the caller's; only `message.text` carries the caller's own words. The line
 * always reaches the founder's direct room, and also the agent's team room (`own`, the default) or the common room (`everyone`) when
 * the agent holds the right to post there; the facts list the rooms posted to and what was skipped and why, and a missing room or right
 * never refuses. Once per key: a retry of the same call finds the lines it wrote. A record that is not there is a refusal fact; a line
 * that cannot be written (the agent or the owner is not of the workspace) fails the step, so a run never reports done for a message
 * nobody received.
 */
export class AgentMessagePostExecutorService implements OnModuleInit {
    constructor(
        private readonly audience: TeamChatAudienceService,
        @Optional() private readonly registry?: GraphNodeRegistryService,
    ) {}

    /** Registers the executor when the app hosts graph nodes; otherwise there is nothing to serve. */
    onModuleInit(): void {
        this.registry?.addExecutor({
            effect: TOOL.teamMessagePost,
            execute: (turn, payload, call) => this.post(turn, payload, call),
        })
    }

    private async post(turn: NodeTurn, payload: EffectPayload, call: EffectCall): Promise<EffectFact> {
        // The engine's own card (never reachable from a model's tool call, whose payload the runner checks against the tool's schema).
        if (payload["kind"] === STOPPED_KIND) return this.stopped(turn, payload, call)
        const parsed = agentMessagePostEffect.payload.safeParse(payload)
        if (!parsed.success) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
        const built = await this.built(turn, parsed.data)
        if ("refused" in built) return refusalOf(built.refused)
        const posted = await this.audience.postTeamCard(turn.workspaceId, {
            agentId: turn.agentId,
            audience: parsed.data.audience ?? DEFAULT_AUDIENCE,
            message: built.message,
            key: lineKeyOf(call.dedupeKey ?? call.key),
        })
        return { kind: "chat-message", id: posted.messageId, facts: posted.facts }
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
        const given = stoppedGivenOf(payload)
        if (given === null) throw new TeamChatError({ code: TeamChatErrorCode.InvalidAgentMessage })
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
        const card = typedPayloadOf(before.data, section)
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

    /** The message of a payload: the caller's words, or the card of the record it names. */
    private async built(turn: NodeTurn, given: AgentMessagePostPayload): Promise<Built> {
        if (given.kind === "message.text") {
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
        return "orderId" in given ? this.orderCard(turn, given.kind, given.orderId) : { refused: "kind_not_postable" }
    }

    /** The card of an order, or of the money that paid it, from the records. */
    private async orderCard(
        turn: NodeTurn,
        kind: "order.summary" | "payment.received",
        orderId: string,
    ): Promise<Built> {
        const [row] = await this.rows(turn, "order", {
            where: { id: orderId },
            fields: ["orderNo", "amountVnd", "items", "note", "deliveryAddress", "leadId"],
            limit: 1,
        })
        const order = cardOrderOf(row)
        if (order === null) return { refused: "order_missing" }
        const leadId = textOf(row?.leadId)
        const [lead] =
            leadId === ""
                ? []
                : await this.rows(turn, "sales-lead", { where: { id: leadId }, fields: ["contactName"], limit: 1 })
        const customer = textOf(lead?.contactName)
        const catalogue = (
            await this.rows(turn, "catalogue-item", { fields: ["name", "imageUrl"], limit: CATALOGUE_ROWS })
        ).map((item) => ({
            name: textOf(item.name),
            imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
        }))
        if (kind === "order.summary") return { message: teamOrderCardOf(order, customer, catalogue, turn.locale) }
        const [credit] = await this.rows(turn, "bank-transaction", {
            where: { orderId },
            fields: ["amountVnd"],
            limit: 1,
        })
        return typeof credit?.amountVnd === "number"
            ? { message: teamPaymentCardOf(order, credit.amountVnd, customer, catalogue, turn.locale) }
            : { refused: "not_paid" }
    }

    /** The rows of a data kind of the workspace; none when the app serves no data ports. */
    private async rows(turn: NodeTurn, kind: string, query: NodeQuery): Promise<ReadonlyArray<NodeRow>> {
        return this.registry === undefined ? [] : await this.registry.portOf(kind).read(turn, query, "workspace")
    }
}
