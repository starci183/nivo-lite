import type { ListPage, ListQuery, ListShape } from "@nivo-lite/agent-sdk/block"
import { unprovided } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition, PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import type { HandlingMember } from "../../../rules/chatbot"
import type {
    ChatSendInput,
    ChatSendResult,
    LeadFacts,
    MessageRecord,
    ThreadRow,
    UpdateOutcome,
} from "../chatbot.types"
import { CONVERSATIONS, DOOR, LEADS, MEMBERS, MESSAGES, OUTBOX, THREADS_LIST } from "../ports"
import type {
    ChatDoor,
    ChatOutbox,
    ConversationStore,
    DeliverReplyInput,
    LeadDirectory,
    MemberDirectory,
    MessageStore,
    ThreadsList,
} from "../ports"
import { THREAD_ROWS } from "./chatbot.fixtures"

/** The member of the fake workspace who is staff. */
export const STAFF_ID = "member-staff"

/** The member of the fake workspace who is a manager. */
export const MANAGER_ID = "member-manager"

/** A request scope of the staff member at a fixed instant. */
export const STAFF_CONTEXT: RunContext = {
    workspaceId: "w1",
    memberId: STAFF_ID,
    now: new Date("2026-11-05T03:00:00.000Z"),
}

/** Everything the fake ports read and record, so a spec can set it up and look at it. */
export interface MemoryWorld {
    /** The conversations by id. */
    readonly conversations: Map<string, ThreadRow>
    /** The stored lines, oldest first. */
    readonly lines: Array<MessageRecord>
    /** The members by id. */
    readonly members: Map<string, HandlingMember>
    /** The customers by id. */
    readonly leads: Map<string, LeadFacts>
    /** The jobs the outbox was asked for. */
    readonly jobs: Array<DeliverReplyInput>
    /** What the door was asked to send. */
    readonly sends: Array<ChatSendInput>
    /** The queries the list source was asked a page for. */
    readonly queries: Array<ListQuery>
    /** What the door answers. */
    door: ChatSendResult
}

/** A world holding the fixture conversations, a staff member and a manager, one customer and no lines. */
export const memoryWorld = (): MemoryWorld => ({
    conversations: new Map(THREAD_ROWS.map((row) => [row.id, row])),
    lines: [],
    members: new Map([
        [STAFF_ID, { displayName: "L\u00ea Thu H\u00e0", isManager: false }],
        [MANAGER_ID, { displayName: "Lan Pham", isManager: true }],
    ]),
    leads: new Map([
        [
            "l1",
            {
                contactName: "Nguy\u1ec5n Minh Anh",
                company: "Hoa Sen Studio",
                stage: "qualified",
                need: "Two flower pots",
                phone: "0901234567",
                email: "minh@example.com",
            },
        ],
    ]),
    jobs: [],
    sends: [],
    queries: [],
    door: { ok: true },
})

/** The next version token of a record. */
const nextVersion = (version: string): string => String(Number(version) + 1)

/** The rows of a keyset page: `size` rows from the offset the cursor names, and the cursor of the rest. */
const slicePage = <T>(rows: ReadonlyArray<T>, cursor: string | null, size: number): ListPage<T> => {
    const from = cursor === null ? 0 : Number(cursor)
    return { rows: rows.slice(from, from + size), cursor: from + size < rows.length ? String(from + size) : null }
}

/** The conversations port over a world. */
export const conversationStore = (world: MemoryWorld): ConversationStore => ({
    get: (id) => Promise.resolve(world.conversations.get(id) ?? null),
    update: (id, expected, patch): Promise<UpdateOutcome<ThreadRow>> => {
        const row = world.conversations.get(id)
        if (row === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        if (row.version !== expected) return Promise.resolve({ ok: false, reason: "conflict" })
        const next: ThreadRow = { ...row, ...patch, version: nextVersion(row.version) }
        world.conversations.set(id, next)
        return Promise.resolve({ ok: true, row: next })
    },
})

/** The lines port over a world. */
export const messageStore = (world: MemoryWorld): MessageStore => ({
    get: (id) => Promise.resolve(world.lines.find((line) => line.id === id) ?? null),
    insert: (message) => {
        const stored: MessageRecord = {
            ...message,
            id: `m${world.lines.length + 1}`,
            version: "1",
            status: message.status ?? "posted",
            deliveryStatus: null,
            deliveryError: null,
        }
        world.lines.push(stored)
        return Promise.resolve(stored)
    },
    update: (id, expected, patch): Promise<UpdateOutcome<MessageRecord>> => {
        const index = world.lines.findIndex((line) => line.id === id)
        const row = world.lines[index]
        if (row === undefined) return Promise.resolve({ ok: false, reason: "missing" })
        if (row.version !== expected) return Promise.resolve({ ok: false, reason: "conflict" })
        const next: MessageRecord = { ...row, ...patch, version: nextVersion(row.version) }
        world.lines[index] = next
        return Promise.resolve({ ok: true, row: next })
    },
    proposed: (conversationId) =>
        Promise.resolve(
            world.lines.find((line) => line.conversationId === conversationId && line.status === "proposed") ?? null,
        ),
    page: (conversationId, cursor, size) =>
        Promise.resolve(
            slicePage(
                world.lines
                    .filter((line) => line.conversationId === conversationId && line.status === "posted")
                    .toReversed(),
                cursor,
                size,
            ),
        ),
})

/** The list source over a world. */
export const threadsList = (world: MemoryWorld): ThreadsList => ({
    page: (_shape: ListShape, query: ListQuery) => {
        world.queries.push(query)
        return Promise.resolve(slicePage([...world.conversations.values()], query.cursor, query.size))
    },
    counts: (_shape: ListShape, by: string) => {
        const counts: Record<string, number> = {}
        for (const row of world.conversations.values()) {
            const value = by === "channel" ? row.channel : row.status
            counts[value] = (counts[value] ?? 0) + 1
        }
        return Promise.resolve(counts)
    },
})

const memberDirectory = (world: MemoryWorld): MemberDirectory => ({
    get: (memberId) => Promise.resolve(world.members.get(memberId) ?? null),
})

const leadDirectory = (world: MemoryWorld): LeadDirectory => ({
    get: (id) => Promise.resolve(world.leads.get(id) ?? null),
})

const outbox = (world: MemoryWorld): ChatOutbox => ({
    enqueue: (_job, input) => {
        world.jobs.push(input)
        return Promise.resolve()
    },
})

/** The door over a world: records what it was asked and answers what the world says. */
export const chatDoor = (world: MemoryWorld): ChatDoor => ({
    call: (_tool, input) => {
        world.sends.push(input)
        return Promise.resolve(world.door)
    },
})

/** The implementation of each port of the module over a world; a port outside the module is unprovided. */
export const memoryProvider = (world: MemoryWorld): PortProvider => ({
    implementationOf: (port: PortDefinition<unknown>): unknown => {
        if (port.id === THREADS_LIST.id) return threadsList(world)
        if (port.id === CONVERSATIONS.id) return conversationStore(world)
        if (port.id === MESSAGES.id) return messageStore(world)
        if (port.id === MEMBERS.id) return memberDirectory(world)
        if (port.id === LEADS.id) return leadDirectory(world)
        if (port.id === OUTBOX.id) return outbox(world)
        if (port.id === DOOR.id) return chatDoor(world)
        return unprovided(port)
    },
})
