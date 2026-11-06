import type { CountsResult, ListPage } from "@nivo-lite/agent-sdk/block"
import type { ModuleFixtures } from "../../module-fixtures"
import type { ThreadLine } from "../../../rules/chatbot"
import type { ThreadRow, ThreadView } from "../chatbot.types"

const AT = "2026-11-03T09:00:00.000Z"

/** The conversation where a customer waits for a person. */
export const WAITING_ROW: ThreadRow = {
    id: "c1",
    version: "3",
    name: "Minh Anh Nguyen",
    channel: "zalo",
    externalId: "84901234567",
    status: "needs",
    waiting: true,
    handledBy: null,
    handledAt: null,
    lastText: "Does this pot come with a root warranty?",
    lastRole: "user",
    lastAt: "2026-11-04T01:09:00.000Z",
    unanswered: true,
    messageCount: 5,
}

/** The conversation a person holds. */
export const HANDLED_ROW: ThreadRow = {
    id: "c2",
    version: "7",
    name: "Bao Tran Le",
    channel: "telegram",
    externalId: "55501",
    status: "handled",
    waiting: false,
    handledBy: "Thu Ha Le",
    handledAt: "2026-11-04T00:30:00.000Z",
    lastText: "I will send the invoice this afternoon.",
    lastRole: "agent",
    lastAt: "2026-11-04T00:45:00.000Z",
    unanswered: false,
    messageCount: 9,
}

const AI_ROWS: ReadonlyArray<ThreadRow> = [
    {
        id: "c3",
        version: "2",
        name: "Quang Huy Pham",
        channel: "website",
        externalId: null,
        status: "ai",
        waiting: false,
        handledBy: null,
        handledAt: null,
        lastText: "Yes, we deliver to Da Nang in two days.",
        lastRole: "agent",
        lastAt: "2026-11-03T14:02:40.000Z",
        unanswered: false,
        messageCount: 4,
    },
    {
        id: "c4",
        version: "1",
        name: "",
        channel: "facebook",
        externalId: "fb-77",
        status: "ai",
        waiting: false,
        handledBy: null,
        handledAt: null,
        lastText: "Hello, how much is the small pot?",
        lastRole: "user",
        lastAt: AT,
        unanswered: false,
        messageCount: 1,
    },
]

/** The conversations of a ready inbox, newest activity first. */
export const THREAD_ROWS: ReadonlyArray<ThreadRow> = [WAITING_ROW, HANDLED_ROW, ...AI_ROWS]

/** The conversations of an inbox where only the owner is waited for. */
export const WAITING_THREAD_ROWS: ReadonlyArray<ThreadRow> = [WAITING_ROW]

const EMPTY_COUNTS: CountsResult = { counts: {}, total: 0 }

const page = (rows: ReadonlyArray<ThreadRow>): ListPage<ThreadRow> => ({ rows, cursor: null })

/** The conversations per status under no search. */
export const STATUS_COUNTS: CountsResult = { counts: { needs: 1, handled: 1, ai: 2 }, total: 4 }

/** The conversations per channel under no search. */
export const CHANNEL_COUNTS_DATA: CountsResult = { counts: { zalo: 1, telegram: 1, website: 1, facebook: 1 }, total: 4 }

/** The customer pane of a conversation that waits for a person. */
export const WAITING_VIEW: ThreadView = {
    id: "c1",
    name: "Minh Anh Nguyen",
    channelName: "Zalo",
    status: "needs",
    handledBy: "",
    stage: "qualified",
    need: "Two flower pots, delivered tomorrow",
    company: "",
    phone: "0901234567",
    email: "",
}

/** The customer pane of a conversation a person holds. */
export const HANDLED_VIEW: ThreadView = {
    id: "c2",
    name: "Bao Tran Le",
    channelName: "Telegram",
    status: "handled",
    handledBy: "Thu Ha Le",
    stage: "proposal",
    need: "Ten office plants every month",
    company: "Lotus Studio",
    phone: "0912345678",
    email: "tran@example.com",
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
        "chatbot.threads": {
            ready: page(THREAD_ROWS),
            empty: page([]),
            waiting: page(WAITING_THREAD_ROWS),
        },
        "chatbot.thread-counts": {
            ready: STATUS_COUNTS,
            empty: EMPTY_COUNTS,
            waiting: { counts: { needs: 1 }, total: 1 },
        },
        "chatbot.channel-counts": {
            ready: CHANNEL_COUNTS_DATA,
            empty: EMPTY_COUNTS,
            waiting: { counts: { zalo: 1 }, total: 1 },
        },
        "chatbot.thread": { ready: HANDLED_VIEW, waiting: WAITING_VIEW },
        "chatbot.messages": {
            ready: { rows: READY_LINES, cursor: null },
            empty: { rows: [], cursor: null },
            waiting: { rows: WAITING_LINES, cursor: null },
        },
        "chatbot.proposals": {
            ready: {
                id: "m8",
                asked: "Does this pot come with a root warranty?",
                text: "Yes, the root is covered for one year.",
                note: "",
            },
            empty: null,
        },
    },
    actions: {
        "chatbot.reply": { ok: true, data: { messageId: "m9" } },
        "chatbot.handoff": { ok: true, data: { handledBy: "Thu Ha Le" } },
        "chatbot.release": { ok: true, data: { handledBy: null } },
        "chatbot.approve-and-send": { ok: true, data: { messageId: "m8" } },
        "chatbot.reject-proposal": { ok: true },
    },
}
