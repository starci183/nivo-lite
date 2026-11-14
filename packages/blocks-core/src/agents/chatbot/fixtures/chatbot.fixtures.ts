import type { CountsResult, ListPage } from "@nivo-lite/agent-sdk/block"
import { chatDecisionQueueOf } from "../rules/decisions"
import { chatFiguresOf } from "../rules/figures"
import type { ModuleFixtures } from "../../../shared/modules/module-fixtures"
import { inboxStatusOf, type ThreadLine } from "../rules"
import type { ThreadRow, ThreadView } from "../chatbot.types"
import type { LastLine } from "../reads/last-lines"
import type { ShownHolder } from "../reads/route-holder"

const AT = "2026-11-03T09:00:00.000Z"

/** The conversation where a customer waits for a person. */
export const WAITING_ROW: ThreadRow = {
    id: "c1",
    version: "3",
    name: "Minh Anh Nguyen",
    channel: "zalo",
    contactId: "0c0a0000-0000-4000-8000-0000000000c1",
    routeId: "0c0a0000-0000-4000-8000-0000000000a1",
    startedAt: "2026-11-04T01:00:00.000Z",
    status: "needs",
    waiting: true,
    lastAt: "2026-11-04T01:09:00.000Z",
    unanswered: true,
}

/** The conversation a person holds: the hold is the engine's, on its route (ruling R43), so the chat itself stores only its own mark. */
export const HANDLED_ROW: ThreadRow = {
    id: "c2",
    version: "7",
    name: "Bao Tran Le",
    channel: "telegram",
    contactId: "0c0a0000-0000-4000-8000-0000000000c2",
    routeId: "route-2",
    startedAt: "2026-11-04T00:30:00.000Z",
    status: "ai",
    waiting: false,
    lastAt: "2026-11-04T00:45:00.000Z",
    unanswered: false,
}

const AI_ROWS: ReadonlyArray<ThreadRow> = [
    {
        id: "c3",
        version: "2",
        name: "Quang Huy Pham",
        channel: "website",
        contactId: null,
        routeId: null,
        startedAt: null,
        status: "ai",
        waiting: false,
        lastAt: "2026-11-03T14:02:40.000Z",
        unanswered: false,
    },
    {
        id: "c4",
        version: "1",
        name: "",
        channel: "facebook",
        contactId: null,
        routeId: null,
        startedAt: null,
        status: "ai",
        waiting: false,
        lastAt: AT,
        unanswered: false,
    },
]

/** The conversations of a ready inbox, newest activity first. */
export const THREAD_ROWS: ReadonlyArray<ThreadRow> = [WAITING_ROW, HANDLED_ROW, ...AI_ROWS]

/** A conversation as a list shows it: the chat, the last line said on its route and who holds the route (the engine's, joined by the read). */
export type ListedThread = Omit<ThreadRow, "status"> & LastLine & ShownHolder

/** The last line said in each fixture conversation, as the engine keeps it. */
const LAST_LINES: Readonly<Record<string, LastLine>> = {
    c1: { lastText: "Does this pot come with a root warranty?", lastRole: "user" },
    c2: { lastText: "I will send the invoice this afternoon.", lastRole: "agent" },
    c3: { lastText: "Yes, we deliver to Da Nang in two days.", lastRole: "agent" },
    c4: { lastText: "Hello, how much is the small pot?", lastRole: "user" },
}

/** The fixture route a staff member holds (the engine's hold of `HANDLED_ROW`'s route, ruling R43), with the holder's name. */
const HOLDERS: Readonly<Record<string, string>> = { [HANDLED_ROW.id]: "Thu Ha Le" }

/** A conversation with its last line and its shown status and holder. */
const listedOf = (row: ThreadRow): ListedThread => {
    const handledBy = HOLDERS[row.id] ?? ""
    return {
        ...row,
        ...(LAST_LINES[row.id] ?? { lastText: "", lastRole: null }),
        status: inboxStatusOf({ waiting: row.waiting, held: handledBy !== "" }),
        handledBy,
    }
}

/** The conversations of a ready inbox as the list read answers them. */
export const LISTED_ROWS: ReadonlyArray<ListedThread> = THREAD_ROWS.map(listedOf)

/** The conversations of an inbox where only the owner is waited for, as the list read answers them. */
export const WAITING_THREAD_ROWS: ReadonlyArray<ListedThread> = [listedOf(WAITING_ROW)]

const EMPTY_COUNTS: CountsResult = { counts: {}, total: 0 }

const page = (rows: ReadonlyArray<ListedThread>): ListPage<ListedThread> => ({ rows, cursor: null })

/** The conversations of one contact as the contact detail draws them: the row of the Chatbot's own read, without the bookkeeping. */
const contactRowOf = (row: ListedThread) => ({
    id: row.id,
    name: row.name,
    channel: row.channel,
    status: row.status,
    lastText: row.lastText,
    lastAt: row.lastAt,
})

/** The conversations per stored mark under no search (a held route is no stored mark, ruling R43). */
export const STATUS_COUNTS: CountsResult = { counts: { needs: 1, ai: 3, today: 2, handled: 1 }, total: 4 }

/** The conversations per channel under no search. */
export const CHANNEL_COUNTS_DATA: CountsResult = { counts: { zalo: 1, telegram: 1, website: 1, facebook: 1 }, total: 4 }

/** The customer pane of a conversation that waits for a person. */
export const WAITING_VIEW: ThreadView = {
    id: "c1",
    name: "Minh Anh Nguyen",
    channelName: "Zalo",
    avatarUrl: "",
    contactId: "0c0a0000-0000-4000-8000-0000000000c1",
    routeId: "0c0a0000-0000-4000-8000-0000000000a1",
    status: "needs",
    handledBy: "",
}

/** The customer pane of a conversation a person holds. */
export const HANDLED_VIEW: ThreadView = {
    id: "c2",
    name: "Bao Tran Le",
    channelName: "Telegram",
    avatarUrl: "",
    contactId: "0c0a0000-0000-4000-8000-0000000000c2",
    routeId: "route-2",
    status: "handled",
    handledBy: "Thu Ha Le",
}

const line = (
    id: string,
    side: ThreadLine["side"],
    text: string,
    at: string,
    extra: Partial<ThreadLine>,
): ThreadLine => ({
    id,
    text,
    who: "",
    at,
    side,
    state: "",
    mark: "",
    sentBy: "",
    ...extra,
})

/** The thread of a conversation the AI and a person answered. */
export const READY_LINES: ReadonlyArray<ThreadLine> = [
    line("m1", "incoming", "Hi, I would like two flower pots like last time.", "2026-11-03T14:02:00.000Z", {
        who: "Bao Tran Le",
    }),
    line("m2", "outgoing", "Hello, we have five pots left. Same address as before?", "2026-11-03T14:02:40.000Z", {
        who: "AI",
        state: "sent",
        mark: "AI",
    }),
    line("m3", "notice", "Thu Ha Le took over the conversation.", "2026-11-04T00:30:00.000Z", {}),
    line("m4", "outgoing", "I will send the invoice this afternoon.", "2026-11-04T00:45:00.000Z", {
        who: "Thu Ha Le",
        state: "queued",
    }),
]

/** The thread of a conversation whose last question waits for the owner. */
export const WAITING_LINES: ReadonlyArray<ThreadLine> = [
    line("m5", "incoming", "Does this pot come with a root warranty?", "2026-11-04T01:09:00.000Z", {
        who: "Minh Anh Nguyen",
    }),
]

/** The Chatbot reads in the states a prototype draws (ready, empty, and what waits for the owner) and the answer of each action. Loading and error need no data. */
export const CHATBOT_FIXTURES: ModuleFixtures = {
    reads: {
        "blocks-core.chatbot.api.chat.list": {
            ready: page(LISTED_ROWS),
            empty: page([]),
            waiting: page(WAITING_THREAD_ROWS),
        },
        "blocks-core.chatbot.api.chat.of-contact": {
            ready: { rows: [contactRowOf(listedOf(WAITING_ROW)), contactRowOf(listedOf(HANDLED_ROW))], cursor: null },
            empty: { rows: [], cursor: null },
        },
        "blocks-core.chatbot.api.chat.status-counts": {
            ready: STATUS_COUNTS,
            empty: EMPTY_COUNTS,
            waiting: { counts: { needs: 1 }, total: 1 },
        },
        "blocks-core.chatbot.api.chat.channel-counts": {
            ready: CHANNEL_COUNTS_DATA,
            empty: EMPTY_COUNTS,
            waiting: { counts: { zalo: 1 }, total: 1 },
        },
        "blocks-core.chatbot.api.chat.figures": {
            ready: chatFiguresOf(STATUS_COUNTS.counts, 1),
            empty: chatFiguresOf({}, 0),
        },
        "blocks-core.chatbot.api.chat.waiting": {
            ready: chatDecisionQueueOf(WAITING_THREAD_ROWS, WAITING_THREAD_ROWS.length),
            empty: chatDecisionQueueOf([], 0),
        },
        "blocks-core.chatbot.api.settings.get": {
            ready: { holdingMessage: "Please wait a moment.", updatedBy: "Thu Ha" },
        },
        "blocks-core.chatbot.api.chat.get": { ready: HANDLED_VIEW, waiting: WAITING_VIEW },
        "blocks-core.chatbot.api.message.list": {
            ready: { rows: READY_LINES, cursor: null },
            empty: { rows: [], cursor: null },
            waiting: { rows: WAITING_LINES, cursor: null },
        },
    },
    actions: {
        "blocks-core.chatbot.chat-reply": { ok: true, data: { key: "0c0a0000-0000-4000-8000-0000000000f9" } },
        "blocks-core.chatbot.chat-handoff": { ok: true, data: { heldBy: "member-staff" } },
        "blocks-core.chatbot.chat-release": { ok: true, data: { heldBy: null } },
        "blocks-core.chatbot.settings-save": { ok: true },
        "blocks-core.chatbot.chat-decide": { ok: true, data: { heldBy: "member-staff" } },
    },
}
