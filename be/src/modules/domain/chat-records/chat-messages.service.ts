import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import type { EntitiesApi, RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { q } from "@nivo-lite/agent-sdk/query"
import type { FilterExpr, Query } from "@nivo-lite/agent-sdk/query"
import { patchAfterLine } from "@nivo-lite/blocks-core/rules/chatbot"
import type { LineFile, LineOrder } from "@nivo-lite/blocks-core/rules/chatbot"
import { CONVERSATION_ENTITY, plainFactsOf, stateOf } from "./chat-conversation.policy"
import { ChatEntitiesService } from "./chat-entities.service"
import {
    MESSAGE_SELECT,
    TRANSCRIPT_MAX,
    answersCustomer,
    customerLineOf,
    filesFieldOf,
    lineOf,
    lineRefOf,
    linesOf,
    orderFieldOf,
    replyOf,
    storedMessageOf,
    transcriptOf,
} from "./chat-lines.policy"
import type { LineFacts } from "./chat-lines.policy"
import type {
    AgentLine,
    ChatCustomerLine,
    ChatDeliveryClaim,
    OptionalChannelRef,
    OptionalLineKey,
    OptionalLineText,
    LineRole,
    OptionalMessageStamp,
    StoredCustomerLine,
    ChatStoredMessage,
    ChatStoredReply,
    ChatTranscriptLine,
} from "./chat-records.contracts"
import { CHAT_DELIVERY_UNKNOWN, heldClaimOf, mayClaim } from "./delivery.policy"
import { ChatRecordsError, ChatRecordsErrorCode } from "./errors/chat-records.error"
import { sentAtOf } from "./message-stamp.policy"

/** The entity of a line. */
const MESSAGE_ENTITY = "chat.message"

/** How often a write retries after another writer moved the record first. */
const WRITE_ATTEMPTS = 3

/** How many of the agent's newest lines the last reply is looked for among, past the holding lines. */
const REPLY_LOOKBACK = 20

/** A line to store: its values and the instant it is said at. */
interface NewLine {
    readonly conversationId: string
    readonly role: "user" | "agent" | "system"
    readonly text: string
    readonly sentAt: string
    readonly channelRef: string | null
    readonly inReplyTo: string | null
    /** The agent that sent the line, when an agent did. */
    readonly sentBy?: string | null | undefined
    /** The pictures and files the line carries. */
    readonly files?: ReadonlyArray<LineFile> | undefined
    /** The order the line is about. */
    readonly order?: LineOrder | undefined
    readonly author: {
        readonly kind: "ai" | "human"
        readonly name: string | null
        readonly userId: string | null
    } | null
}

/** What an insert answered: the stored line's id, or the line another writer had stored first. */
type Inserted =
    | { readonly created: true; readonly id: string }
    | { readonly created: false; readonly id: string; readonly line: LineFacts }

/** What moves the tail of a conversation. */
interface TailInput {
    readonly role: "user" | "agent" | "system"
    readonly text: string
    readonly sentAt: string
}

/** The query of the lines a condition selects in one conversation, in the order and number given. */
const linesQuery = (where: FilterExpr, direction: "asc" | "desc", size: number): Query => ({
    from: MESSAGE_ENTITY,
    select: MESSAGE_SELECT,
    where,
    order: [
        ["sentAt", direction],
        ["id", direction],
    ],
    page: { size },
})

/** The query of the one line stored under a channel key (the key is unique in the workspace). */
const keyedLineQuery = (channelRef: string): Query => ({
    from: MESSAGE_ENTITY,
    select: MESSAGE_SELECT,
    where: q.eq("channelRef", channelRef),
    order: [["id", "asc"]],
    page: { size: 1 },
})

/** True for the lines of one role (a membership test: only the conversation is pinned to the index). */
const roleIs = (role: LineRole): FilterExpr => q.in("role", [role])

/** The lines of one conversation. */
const inConversation = (conversationId: string, ...more: ReadonlyArray<FilterExpr>): FilterExpr =>
    q.and(q.eq("conversationId", conversationId), ...more)

@Injectable()
/**
 * The messages of a conversation between a customer and an agent, as `chat.message` records; the only be code that writes them. A
 * stored line moves the tail of its conversation in the same transaction (`patchAfterLine`), so the inbox never goes stale.
 */
export class ChatMessagesService {
    constructor(
        private readonly entities: ChatEntitiesService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /**
     * Stores what the customer wrote once per channel id of the message and answers its id and whether this call stored it. A channel
     * that timed the message itself passes `stamp`, so a polled or imported burst keeps its order.
     */
    storeCustomer(
        workspaceId: string,
        conversationId: string,
        text: string,
        channelRef: OptionalChannelRef,
        stamp: OptionalMessageStamp,
    ): Promise<StoredCustomerLine> {
        return this.entities.run(workspaceId, async (api) => {
            const known = channelRef === null ? null : await this.keyed(api, channelRef)
            if (known !== null) return { id: known.id, stored: false }
            const line: NewLine = {
                conversationId,
                role: "user",
                text,
                sentAt: sentAtOf(stamp, this.clock.now()),
                channelRef,
                inReplyTo: null,
                author: null,
            }
            const stored = await this.insert(api, line)
            if (stored.created) await this.tail(api, conversationId, line)
            return { id: stored.id, stored: stored.created }
        })
    }

    /**
     * Stores a line the agent or a person says exactly once under its key and answers it: a second attempt answers the line the first
     * one stored (its text, and whether it reached the customer).
     */
    storeAgentLine(line: AgentLine): Promise<ChatStoredReply> {
        return this.entities.run(line.workspaceId, async (api) => {
            const channelRef = lineRefOf(line.key)
            const known = await this.keyed(api, channelRef)
            if (known !== null) return replyOf(known)
            const sentAt = sentAtOf(null, this.clock.now())
            const reply = await this.insert(api, {
                conversationId: line.conversationId,
                role: "agent",
                text: line.body,
                sentAt,
                channelRef,
                inReplyTo: line.inReplyTo ?? null,
                sentBy: line.sentBy ?? null,
                files: line.files,
                order: line.order,
                author:
                    line.human === undefined
                        ? { kind: "ai", name: null, userId: null }
                        : { kind: "human", name: line.human.name, userId: line.human.userId },
            })
            if (!reply.created) return replyOf(reply.line)
            await this.tail(api, line.conversationId, { role: "agent", text: line.body, sentAt })
            return { id: reply.id, body: line.body, sent: false }
        })
    }

    /** Writes a line the workbench shows between the messages; it is never sent to the customer. */
    storeLine(workspaceId: string, conversationId: string, text: string): Promise<void> {
        return this.entities.run(workspaceId, async (api) => {
            const line: NewLine = {
                conversationId,
                role: "system",
                text,
                sentAt: sentAtOf(null, this.clock.now()),
                channelRef: null,
                inReplyTo: null,
                author: null,
            }
            await this.insert(api, line)
            await this.tail(api, conversationId, line)
        })
    }

    /** One stored message of a conversation, or a refusal when it is not there. */
    find(
        workspaceId: string,
        conversationId: string,
        messageId: string,
    ): Promise<Outcome<ChatStoredMessage, ChatRecordsErrorCode>> {
        return this.entities.run(workspaceId, async (api) => {
            const line = await this.lineById(api, messageId)
            return line?.data.conversationId === conversationId
                ? ok(storedMessageOf(line))
                : refused(ChatRecordsErrorCode.NotFound)
        })
    }

    /** True when the agent already stored a reply to the customer message, which makes a new attempt a retry. */
    replyExists(workspaceId: string, conversationId: string, inReplyTo: string): Promise<boolean> {
        return this.entities.run(
            workspaceId,
            async (api) =>
                (await this.readOne(
                    api,
                    inConversation(conversationId, q.eq("inReplyTo", inReplyTo), roleIs("agent")),
                )) !== null,
        )
    }

    /** The final reply already stored, under its key or as the reply to the customer message; null before it is. */
    storedReply(
        workspaceId: string,
        conversationId: string,
        inReplyTo: string,
        key: OptionalLineKey,
    ): Promise<OptionalLineText> {
        return this.entities.run(workspaceId, async (api) => {
            const line =
                key === null
                    ? await this.readOne(
                          api,
                          inConversation(conversationId, q.eq("inReplyTo", inReplyTo), roleIs("agent")),
                      )
                    : await this.keyed(api, lineRefOf(key))
            return line?.data.text ?? null
        })
    }

    /** The customer's messages of a conversation among the ids, in the order they were said; an id that is gone or no customer's is left out. */
    customerLinesOf(
        workspaceId: string,
        conversationId: string,
        ids: ReadonlyArray<string>,
    ): Promise<ReadonlyArray<ChatCustomerLine>> {
        if (ids.length === 0) return Promise.resolve([])
        return this.entities.run(workspaceId, async (api) => {
            const page = await api.list(
                linesQuery(inConversation(conversationId, q.in("id", ids), roleIs("user")), "asc", ids.length),
            )
            return page.rows.flatMap((found) => this.customerLine(found.row))
        })
    }

    /** The customer's messages the agent has not answered yet: every one said after the agent's last reply (all when it never replied), oldest first, at most `limit`. */
    unansweredLinesOf(
        workspaceId: string,
        conversationId: string,
        limit: number,
    ): Promise<ReadonlyArray<ChatCustomerLine>> {
        return this.entities.run(workspaceId, async (api) => {
            const reply = await this.lastReply(api, conversationId)
            const page = await api.list(
                linesQuery(
                    inConversation(
                        conversationId,
                        roleIs("user"),
                        ...(reply === null ? [] : [q.gt("sentAt", reply.data.sentAt)]),
                    ),
                    "asc",
                    limit,
                ),
            )
            return page.rows.flatMap((found) => this.customerLine(found.row))
        })
    }

    /** The recent transcript of the conversation without system lines, oldest first. */
    transcript(workspaceId: string, conversationId: string): Promise<ReadonlyArray<ChatTranscriptLine>> {
        return this.entities.run(workspaceId, async (api) => {
            const page = await api.list(
                linesQuery(inConversation(conversationId, q.ne("role", "system")), "desc", TRANSCRIPT_MAX),
            )
            return transcriptOf(page.rows.flatMap((found) => linesOf(found.row)))
        })
    }

    /** When the customer last wrote, or a refusal when they never did. */
    lastCustomerAt(workspaceId: string, conversationId: string): Promise<Outcome<Date, ChatRecordsErrorCode>> {
        return this.entities.run(workspaceId, async (api) => {
            const line = await this.readNewest(api, inConversation(conversationId, roleIs("user")))
            return line === null ? refused(ChatRecordsErrorCode.NotFound) : ok(new Date(line.data.sentAt))
        })
    }

    /** Fences an external send before it starts; a killed or concurrent attempt remains unknown until reconciled. */
    claimDelivery(workspaceId: string, conversationId: string, messageId: string): Promise<ChatDeliveryClaim> {
        return this.entities.run(workspaceId, (api) => this.claim(api, conversationId, messageId, WRITE_ATTEMPTS))
    }

    /** Writes the verdict of a delivery on the stored message so the workbench can show why a reply did not leave. */
    markDelivery(workspaceId: string, messageId: string, delivered: boolean, error?: string): Promise<void> {
        return this.entities.run(workspaceId, (api) =>
            this.mark(
                api,
                messageId,
                {
                    deliveryStatus: delivered ? "sent" : "failed",
                    deliveryError: delivered ? null : (error ?? "delivery_failed"),
                },
                WRITE_ATTEMPTS,
            ),
        )
    }

    private async claim(
        api: EntitiesApi,
        conversationId: string,
        messageId: string,
        attemptsLeft: number,
    ): Promise<ChatDeliveryClaim> {
        const line = await this.lineById(api, messageId)
        if (line?.data.conversationId !== conversationId) return "missing"
        if (!mayClaim(line.data)) return heldClaimOf(line.data)
        const written = await api.update(MESSAGE_ENTITY, messageId, line.version, {
            deliveryStatus: "failed",
            deliveryError: CHAT_DELIVERY_UNKNOWN,
        })
        if (written.ok) return "send"
        if (written.reason !== "stale") return "missing"
        return attemptsLeft <= 1 ? "ambiguous" : await this.claim(api, conversationId, messageId, attemptsLeft - 1)
    }

    private async mark(
        api: EntitiesApi,
        messageId: string,
        verdict: Readonly<Record<string, string | null>>,
        attemptsLeft: number,
    ): Promise<void> {
        const line = await this.lineById(api, messageId)
        if (line === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotFound })
        const written = await api.update(MESSAGE_ENTITY, messageId, line.version, verdict)
        if (written.ok) return
        if (written.reason !== "stale" || attemptsLeft <= 1)
            throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        await this.mark(api, messageId, verdict, attemptsLeft - 1)
    }

    private customerLine(row: RecordRow): ReadonlyArray<ChatCustomerLine> {
        const line = lineOf(row)
        return line === null ? [] : [customerLineOf(line)]
    }

    private async lineById(api: EntitiesApi, id: string): Promise<LineFacts | null> {
        const row = await api.get(MESSAGE_ENTITY, id)
        return row === null ? null : lineOf(row)
    }

    private async keyed(api: EntitiesApi, channelRef: string): Promise<LineFacts | null> {
        const [found] = (await api.list(keyedLineQuery(channelRef))).rows
        return found === undefined ? null : lineOf(found.row)
    }

    private async readOne(api: EntitiesApi, where: FilterExpr): Promise<LineFacts | null> {
        const [found] = (await api.list(linesQuery(where, "asc", 1))).rows
        return found === undefined ? null : lineOf(found.row)
    }

    /** The agent's newest line that answered the customer: a run's holding line promises a reply and is passed over. */
    private async lastReply(api: EntitiesApi, conversationId: string): Promise<LineFacts | null> {
        const page = await api.list(linesQuery(inConversation(conversationId, roleIs("agent")), "desc", REPLY_LOOKBACK))
        return page.rows.flatMap((found) => linesOf(found.row)).find(answersCustomer) ?? null
    }

    private async readNewest(api: EntitiesApi, where: FilterExpr): Promise<LineFacts | null> {
        const [found] = (await api.list(linesQuery(where, "desc", 1))).rows
        return found === undefined ? null : lineOf(found.row)
    }

    /**
     * Inserts one line linked to its conversation. A line another writer stored first (the same channel key, or the same reply to the same
     * customer message) stores nothing: the stored line is answered instead.
     */
    private async insert(api: EntitiesApi, line: NewLine): Promise<Inserted> {
        const written = await api.insert(
            MESSAGE_ENTITY,
            {
                conversationId: line.conversationId,
                role: line.role,
                text: line.text,
                sentAt: line.sentAt,
                channelRef: line.channelRef,
                inReplyTo: line.inReplyTo,
                authorKind: line.author?.kind ?? null,
                authorName: line.author?.name ?? null,
                authorUserId: line.author?.userId ?? null,
                sentBy: line.sentBy ?? null,
                files: filesFieldOf(line.files),
                orderCard: orderFieldOf(line.order),
            },
            { conversation: line.conversationId },
        )
        if (written.ok) return { created: true, id: written.row.id }
        if (written.reason !== "taken") throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        const existing =
            (line.channelRef === null ? null : await this.keyed(api, line.channelRef)) ??
            (line.inReplyTo === null
                ? null
                : await this.readOne(
                      api,
                      inConversation(line.conversationId, q.eq("inReplyTo", line.inReplyTo), roleIs("agent")),
                  ))
        if (existing === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        return { created: false, id: existing.id, line: existing }
    }

    /** Moves the tail of the conversation after one more line, starting again from what another writer wrote. */
    private async tail(
        api: EntitiesApi,
        conversationId: string,
        line: TailInput,
        attemptsLeft = WRITE_ATTEMPTS,
    ): Promise<void> {
        const row = await api.get(CONVERSATION_ENTITY, conversationId)
        const facts = row === null ? null : plainFactsOf(row)
        if (row === null || facts === null) throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotFound })
        const patch = patchAfterLine(stateOf(facts), { role: line.role, text: line.text, at: line.sentAt })
        const written = await api.update(CONVERSATION_ENTITY, conversationId, row.version, { ...patch })
        if (written.ok) return
        if (written.reason !== "stale" || attemptsLeft <= 1)
            throw new ChatRecordsError({ code: ChatRecordsErrorCode.NotStored })
        await this.tail(api, conversationId, line, attemptsLeft - 1)
    }
}
