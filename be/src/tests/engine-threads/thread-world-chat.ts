import { TOOL } from "@nivo-lite/agent-sdk/names"
import { MemoryContactsStore } from "@tests/fixtures/builders/contacts.builder"
import { MemoryChannelDeliveryStore, MemoryCustomerLineStore, MemoryCustomerRouteStore } from "@tests/fixtures/builders/customer-routes-stores.builder"
import { WorldError } from "./thread-world-records"
import type { AgentWorkOptions } from "@modules/domain/agent-work/agent-work.options"
import type { HeardWake } from "./thread-world-intake"

// THE CHATBOT'S OWN RECORDS AND THE ENGINE'S CUSTOMER STORES IN THE WORLD (after the chat flip of 2026-11-13). The engine keeps no record of
// any agent: the world therefore holds, beside the engine's own stores (the contacts, the routes, the delivery ledger, the raw
// `<provider>.message` rows of the account), the CHATBOT AGENT's two record types (`blocks-core.chatbot.chat` and `.message`) as the
// default record tools of that agent answer them (`nivo.tool.record.*`): the front desk's `hear` step reads and writes them through the
// door, exactly as a node of the package does, and nothing else writes them. The unique keys are the ones the types declare
// (`channel_external_key`, `channel_ref_key`, `reply_once_key`, `one_proposal_key`, and the route a chat belongs to), answered as the
// record tool answers a taken key (`taken`). The world imports nothing of the package: the two type names are literals, as the sales
// world's order type is.

/** The record type of the chatbot's conversation. */
export const CHATBOT_CHAT = "blocks-core.chatbot.chat"
/** The record type of one line of such a conversation. */
export const CHATBOT_MESSAGE = "blocks-core.chatbot.message"

/** One record of the world's store, as the record tools answer it. */
export interface BookRecord {
    /** The record id. */
    readonly id: string
    /** The version, moved by every update. */
    version: number
    /** When it was made. */
    readonly createdAt: string
    /** When it last changed. */
    updatedAt: string
    /** Its fields. */
    values: Record<string, unknown>
}

/** One raw account data row (the engine's `<provider>.message` rows the intake keeps), as the read side answers it. */
export interface RawRow {
    /** The row id. */
    readonly id: string
    /** The connection (account) it belongs to. */
    readonly connectionId: string
    /** The declared type. */
    readonly type: string
    /** The row key (the provider's own id). */
    readonly key: string
    /** The stored value. */
    readonly value: Readonly<Record<string, unknown>>
    /** When it happened. */
    readonly occurredAt: Date
}

/** What the engine and the chatbot hold of customers in a world. */
export class ChatWorld {
    /** The core contacts and their channel identities. */
    readonly contacts = new MemoryContactsStore()

    /** The routes of the people on their entrances (`public.customer_routes`). */
    readonly routes = new MemoryCustomerRouteStore()

    /** The delivery ledger of every outbound customer message of any agent (`public.channel_deliveries`). */
    readonly ledger = new MemoryChannelDeliveryStore()

    /** The engine's store of the conversation (`public.customer_messages`): the lines the person said, and the ledger's rows as the lines said to them. */
    readonly lines = new MemoryCustomerLineStore(this.ledger)

    /** The raw message rows the intake kept, in the order they were written. */
    readonly raw: Array<RawRow> = []

    /** The chatbot agent's conversations, by id. */
    readonly chats = new Map<string, BookRecord>()

    /** The chatbot agent's lines, by id. */
    readonly messages = new Map<string, BookRecord>()

    /** The wakes the customer intake wrote, in order (the engine's wake table, for the customer road only). */
    readonly wakes: Array<HeardWake> = []

    /** Whether the default customer of the world was met (the seed ran). */
    seeded = false

    /**
     * How the channel answers the next pushes: `acknowledged` (delivered) by default; `ambiguous` = the provider timed out or failed after
     * the request left (nothing reaches the person, nobody knows): R74's channel double. Set it back to deliver again.
     */
    channelOutcome: "acknowledged" | "ambiguous" = "acknowledged"


    /** The app's burst defaults (the module's `debounceMs` / `debounceMaxMs`; no env sets them); the settle time a registration asks comes first. */
    app: AgentWorkOptions = {}

    /** Every call of the chatbot's record tools, in order, with the agent whose run made it (what a spec reads to see WHO wrote what). */
    readonly calls: Array<{ readonly tool: string; readonly type: string; readonly agentId: string | null }> = []

    /** The lines of the chatbot's thread in the order they were written, oldest first (a read for the specs). */
    linesOf(chatId?: string): ReadonlyArray<BookRecord> {
        return [...this.messages.values()].filter((row) => chatId === undefined || row.values.conversationId === chatId)
    }
}

/** The text of a value, or empty. */
const textOf = (value: unknown): string => (typeof value === "string" ? value : "")

/** An object's own members, or empty. */
const membersOf = (value: unknown): Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value) ? Object.fromEntries(Object.entries(value)) : {}

/** The refusal fact a record tool answers on the template road. */
const refusal = (code: string): Readonly<Record<string, unknown>> => ({ kind: "refused", id: code, facts: {} })

/** A record as the record tools answer it. */
const recordOf = (record: BookRecord): Readonly<Record<string, unknown>> => ({
    id: record.id,
    version: String(record.version),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    values: structuredClone(record.values),
})

/** The value a field names on a record: the system members or one of its fields. */
const fieldOf = (record: BookRecord, field: string): unknown => {
    if (field === "id") return record.id
    if (field === "createdAt") return record.createdAt
    if (field === "updatedAt") return record.updatedAt
    return record.values[field] ?? null
}

/** Compares two scalars of the same kind; null when they cannot be ordered. */
const orderOf = (left: unknown, right: unknown): number | null => {
    if (typeof left === "number" && typeof right === "number") return left - right
    if (typeof left === "string" && typeof right === "string") return left < right ? -1 : left > right ? 1 : 0
    return null
}

/** Whether a record meets a filter of the shapes the chatbot's services write (`eq`, `ne`, `in`, `gt`, `lt`, `isNull`, `notNull`, `and`, `or`). */
const meets = (record: BookRecord, where: unknown): boolean => {
    const expr = membersOf(where)
    const op = textOf(expr.op)
    const field = textOf(expr.field)
    const value = fieldOf(record, field)
    if (op === "and") return Array.isArray(expr.of) && expr.of.every((part: unknown) => meets(record, part))
    if (op === "or") return Array.isArray(expr.of) && expr.of.some((part: unknown) => meets(record, part))
    if (op === "eq") return JSON.stringify(value) === JSON.stringify(expr.value ?? null)
    if (op === "ne") return JSON.stringify(value) !== JSON.stringify(expr.value ?? null)
    if (op === "in") return Array.isArray(expr.values) && expr.values.some((one: unknown) => JSON.stringify(one) === JSON.stringify(value))
    if (op === "isNull") return value === null
    if (op === "notNull") return value !== null
    if (op === "gt" || op === "lt") {
        const order = orderOf(value, expr.value)
        if (order === null) return false
        return op === "gt" ? order > 0 : order < 0
    }
    throw new WorldError({ code: "WORLD_FILTER_UNREAD", params: { op } })
}

/** The members a read keeps of a record (`fields`, the record's own system members always). */
const sorted = (rows: ReadonlyArray<BookRecord>, order: unknown): ReadonlyArray<BookRecord> => {
    const pairs = (Array.isArray(order) ? order : []).flatMap((pair: unknown): ReadonlyArray<readonly [string, string]> =>
        Array.isArray(pair) && typeof pair[0] === "string" ? [[pair[0], textOf(pair[1])] as const] : [],
    )
    return rows.toSorted((left, right) => {
        for (const [field, direction] of pairs) {
            const order = orderOf(fieldOf(left, field), fieldOf(right, field))
            if (order !== null && order !== 0) return direction === "desc" ? -order : order
        }
        return 0
    })
}

/** The unique keys of the two types: each answers the other record that already holds the key, or none. */
const keyHolderOf = (chat: ChatWorld, type: string, values: Readonly<Record<string, unknown>>, self: string | null): BookRecord | null => {
    const others = (rows: Map<string, BookRecord>): ReadonlyArray<BookRecord> => [...rows.values()].filter((row) => row.id !== self)
    const same = (row: BookRecord, fields: ReadonlyArray<string>): boolean => fields.every((field) => JSON.stringify(row.values[field] ?? null) === JSON.stringify(values[field] ?? null))
    if (type === CHATBOT_CHAT) {
        // `channel_external_key` (where the person's id on the channel is set) and one chat per route and agent (where the route is set).
        const external = values.externalId !== undefined && values.externalId !== null
        const routed = values.routeId !== undefined && values.routeId !== null
        return (
            others(chat.chats).find(
                (row) =>
                    (external && same(row, ["channel", "connectionId", "externalId"])) || (routed && same(row, ["agentId", "routeId"])),
            ) ?? null
        )
    }
    const channelRef = values.channelRef !== undefined && values.channelRef !== null
    const replying = values.role === "agent" && values.inReplyTo !== undefined && values.inReplyTo !== null
    const proposing = values.status === "proposed"
    return (
        others(chat.messages).find(
            (row) =>
                (channelRef && same(row, ["channelRef"])) ||
                (replying && row.values.role === "agent" && same(row, ["conversationId", "inReplyTo"])) ||
                (proposing && row.values.status === "proposed" && same(row, ["conversationId"])),
        ) ?? null
    )
}

/** The defaults the types declare for the members a write leaves out. */
const withDefaults = (type: string, values: Record<string, unknown>, at: string): Record<string, unknown> =>
    type === CHATBOT_CHAT
        ? {
              channel: "website",
              contactId: null,
              connectionId: null,
              externalId: null,
              name: "",
              status: "ai",
              waiting: false,
              unanswered: false,
              lastText: "",
              lastRole: null,
              lastAt: null,
              messageCount: 0,
              agentId: null,
              frontAgentId: null,
              routeId: null,
              ...values,
          }
        : {
              authorKind: null,
              authorName: null,
              authorUserId: null,
              status: "posted",
              deliveryStatus: null,
              deliveryError: null,
              channelRef: null,
              inReplyTo: null,
              sentBy: null,
              files: null,
              orderCard: null,
              sentAt: at,
              ...values,
          }

/** The record tools of the chatbot's two types, or null for a tool or a type that is none of the chatbot's. */
export const chatRecordCall = (chat: ChatWorld, now: string, tool: string, args: unknown, agentId: string | null = null): unknown => {
    if (tool !== TOOL.recordGet && tool !== TOOL.recordList && tool !== TOOL.recordCreate && tool !== TOOL.recordUpdate) return null
    const given = membersOf(args)
    const type = textOf(given.type)
    if (type !== CHATBOT_CHAT && type !== CHATBOT_MESSAGE) return null
    chat.calls.push({ tool, type, agentId })
    const rows = type === CHATBOT_CHAT ? chat.chats : chat.messages
    if (tool === TOOL.recordList) {
        const found = [...rows.values()].filter((row) => given.where === undefined || meets(row, given.where))
        const limit = typeof given.limit === "number" ? given.limit : found.length
        return { records: sorted(found, given.order).slice(0, limit).map((row) => recordOf(row)), next: null }
    }
    if (tool === TOOL.recordGet) {
        const record = rows.get(textOf(given.id))
        return record === undefined ? refusal("not_found") : { record: recordOf(record) }
    }
    if (tool === TOOL.recordCreate) {
        const written = membersOf(given.values)
        // A relation the type requires (a line names its conversation) comes as `links`; it is stored as the field `<relation>Id`.
        const links = membersOf(given.links)
        const linked = Object.fromEntries(Object.entries(links).map(([name, id]) => [`${name}Id`, id]))
        const values = withDefaults(type, { ...written, ...linked }, now)
        if (type === CHATBOT_MESSAGE && !chat.chats.has(textOf(values.conversationId))) return refusal("invalid_value")
        if (keyHolderOf(chat, type, values, null) !== null) return refusal("taken")
        const id = `${type === CHATBOT_CHAT ? "chat" : "line"}-${String(rows.size + 1).padStart(4, "0")}`
        const record: BookRecord = { id, version: 1, createdAt: now, updatedAt: now, values }
        rows.set(id, record)
        return { record: recordOf(record) }
    }
    const record = rows.get(textOf(given.id))
    if (record === undefined) return refusal("not_found")
    if (given.version !== undefined && String(given.version) !== String(record.version)) return refusal("stale")
    const patched = { ...record.values, ...membersOf(given.patch) }
    if (keyHolderOf(chat, type, patched, record.id) !== null) return refusal("taken")
    record.values = patched
    record.version += 1
    record.updatedAt = now
    return { record: recordOf(record) }
}

/** One line of a thread as the model-facing read answers it. */
interface ThreadFact {
    readonly role: string
    readonly text: string
    readonly at: string
    readonly key: string
    /** The pictures and files kept with a line the person said (the engine's thread answers `{ url, contentType }` of each). */
    readonly files?: ReadonlyArray<{ readonly url: string; readonly contentType: string }>
}

/**
 * The model-facing thread read of EVERY agent (`nivo.tool.conversation.message.list`, owner ruling R26): the engine's own lines of the run's
 * route, both directions, newest first: what the person said (the engine's store of heard lines) and what was told to them (the delivery
 * ledger, delivered rows only: a claimed, refused or unknown send was not told). No chatbot record is read. Same rule as the engine's
 * `CustomerMessageNativeService`; this is the world's synchronous read of it over the memory stores.
 */
export const chatThreadOf = (
    chat: ChatWorld,
    routeId: string | null,
    contactId: string | null,
    limit: number,
): ReadonlyArray<Readonly<{ role: string; text: string; at: string; files?: ReadonlyArray<{ url: string; contentType: string }> }>> => {
    const onRoute = (route: string, contact: string): boolean => route === routeId || (contactId !== null && contact === contactId)
    const facts: Array<ThreadFact> = [
        ...chat.lines.heard
            .filter((row) => onRoute(row.routeId, row.contactId))
            .map((row) => ({
                role: "user",
                text: row.text,
                at: row.saidAt,
                key: row.id,
                ...(row.files.length === 0 ? {} : { files: row.files.map((file) => ({ url: file.url, contentType: file.contentType })) }),
            })),
        ...chat.ledger.rows
            .filter((row) => row.state === "delivered" && onRoute(row.routeId, row.contactId))
            .map((row) => ({ role: "agent", text: row.text, at: row.deliveredAt ?? row.createdAt, key: row.id })),
    ]
    return facts
        .toSorted((left, right) => right.at.localeCompare(left.at) || right.key.localeCompare(left.key))
        .slice(0, limit)
        .map(({ role, text, at, files }) => ({ role, text, at, ...(files === undefined ? {} : { files }) }))
}
