import type { CountsResult, ListPage } from "@nivo-lite/agent-sdk/block"
import { chatDecisionQueueOf } from "../../../rules/chatbot/decisions"
import { chatFiguresOf } from "../../../rules/chatbot/figures"
import type { ModuleFixtures } from "../../module-fixtures"
import type { ThreadLine } from "../../../rules/chatbot"
import type { ThreadRow, ThreadView } from "../chatbot.types"

const AT = "2026-11-03T09:00:00.000Z"

/** The conversation where a customer waits for a person. */
export const WAITING_ROW: ThreadRow = {
    id: "c1",
    version: "3",
    name: "Nguy\u1ec5n Minh Anh",
    channel: "zalo",
    externalId: "84901234567",
    status: "needs",
    waiting: true,
    handledBy: null,
    handledAt: null,
    lastText: "Ch\u1eadu n\u00e0y c\u00f3 b\u1ea3o h\u00e0nh r\u1ec5 kh\u00f4ng \u1ea1?",
    lastRole: "user",
    lastAt: "2026-11-04T01:09:00.000Z",
    unanswered: true,
    messageCount: 5,
    leadId: "l1",
}

/** The conversation a person holds. */
export const HANDLED_ROW: ThreadRow = {
    id: "c2",
    version: "7",
    name: "L\u00ea B\u1ea3o Tr\u00e2n",
    channel: "telegram",
    externalId: "55501",
    status: "handled",
    waiting: false,
    handledBy: "L\u00ea Thu H\u00e0",
    handledAt: "2026-11-04T00:30:00.000Z",
    lastText: "Chi\u1ec1u nay em s\u1ebd g\u1eedi h\u00f3a \u0111\u01a1n cho ch\u1ecb \u1ea1.",
    lastRole: "agent",
    lastAt: "2026-11-04T00:45:00.000Z",
    unanswered: false,
    messageCount: 9,
    leadId: "l2",
}

const AI_ROWS: ReadonlyArray<ThreadRow> = [
    {
        id: "c3",
        version: "2",
        name: "Ph\u1ea1m Quang Huy",
        channel: "website",
        externalId: null,
        status: "ai",
        waiting: false,
        handledBy: null,
        handledAt: null,
        lastText: "D\u1ea1 b\u00ean em giao \u0110\u00e0 N\u1eb5ng trong hai ng\u00e0y \u1ea1.",
        lastRole: "agent",
        lastAt: "2026-11-03T14:02:40.000Z",
        unanswered: false,
        messageCount: 4,
        leadId: null,
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
        lastText: "Ch\u00e0o shop, ch\u1eadu nh\u1ecf gi\u00e1 bao nhi\u00eau \u1ea1?",
        lastRole: "user",
        lastAt: AT,
        unanswered: false,
        messageCount: 1,
        leadId: null,
    },
]

/** The conversations of a ready inbox, newest activity first. */
export const THREAD_ROWS: ReadonlyArray<ThreadRow> = [WAITING_ROW, HANDLED_ROW, ...AI_ROWS]

/** The conversations of an inbox where only the owner is waited for. */
export const WAITING_THREAD_ROWS: ReadonlyArray<ThreadRow> = [WAITING_ROW]

const EMPTY_COUNTS: CountsResult = { counts: {}, total: 0 }

const page = (rows: ReadonlyArray<ThreadRow>): ListPage<ThreadRow> => ({ rows, cursor: null })

/** The conversations per status under no search. */
export const STATUS_COUNTS: CountsResult = { counts: { needs: 1, handled: 1, ai: 2, today: 2 }, total: 4 }

/** The conversations per channel under no search. */
export const CHANNEL_COUNTS_DATA: CountsResult = { counts: { zalo: 1, telegram: 1, website: 1, facebook: 1 }, total: 4 }

/** The customer pane of a conversation that waits for a person. */
export const WAITING_VIEW: ThreadView = {
    id: "c1",
    name: "Nguy\u1ec5n Minh Anh",
    channelName: "Zalo",
    leadId: "l1",
    status: "needs",
    handledBy: "",
    stage: "qualified",
    need: "Hai ch\u1eadu hoa, giao ng\u00e0y mai",
    company: "",
    phone: "0901234567",
    email: "",
}

/** The customer pane of a conversation a person holds. */
export const HANDLED_VIEW: ThreadView = {
    id: "c2",
    name: "L\u00ea B\u1ea3o Tr\u00e2n",
    channelName: "Telegram",
    leadId: "l2",
    status: "handled",
    handledBy: "L\u00ea Thu H\u00e0",
    stage: "proposal",
    need: "M\u01b0\u1eddi ch\u1eadu c\u00e2y v\u0103n ph\u00f2ng m\u1ed7i th\u00e1ng",
    company: "Hoa Sen Studio",
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
    line(
        "m1",
        "incoming",
        "Ch\u00e0o shop, m\u00ecnh mu\u1ed1n l\u1ea5y hai ch\u1eadu hoa nh\u01b0 l\u1ea7n tr\u01b0\u1edbc.",
        "2026-11-03T14:02:00.000Z",
        {
            who: "L\u00ea B\u1ea3o Tr\u00e2n",
        },
    ),
    line(
        "m2",
        "outgoing",
        "D\u1ea1 shop c\u00f2n n\u0103m ch\u1eadu \u1ea1. Giao \u0111\u1ecba ch\u1ec9 nh\u01b0 l\u1ea7n tr\u01b0\u1edbc nh\u00e9?",
        "2026-11-03T14:02:40.000Z",
        {
            who: "AI",
            state: "sent",
            mark: "AI",
        },
    ),
    line("m3", "notice", "L\u00ea Thu H\u00e0 took over the conversation.", "2026-11-04T00:30:00.000Z", {}),
    line(
        "m4",
        "outgoing",
        "Chi\u1ec1u nay em s\u1ebd g\u1eedi h\u00f3a \u0111\u01a1n cho ch\u1ecb \u1ea1.",
        "2026-11-04T00:45:00.000Z",
        {
            who: "L\u00ea Thu H\u00e0",
            state: "queued",
        },
    ),
]

/** The thread of a conversation whose last question waits for the owner. */
export const WAITING_LINES: ReadonlyArray<ThreadLine> = [
    line(
        "m5",
        "incoming",
        "Ch\u1eadu n\u00e0y c\u00f3 b\u1ea3o h\u00e0nh r\u1ec5 kh\u00f4ng \u1ea1?",
        "2026-11-04T01:09:00.000Z",
        {
            who: "Nguy\u1ec5n Minh Anh",
        },
    ),
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
        "chatbot.figures": {
            ready: chatFiguresOf(STATUS_COUNTS.counts),
            empty: chatFiguresOf({}),
        },
        "chatbot.decisions": {
            ready: chatDecisionQueueOf(WAITING_THREAD_ROWS, WAITING_THREAD_ROWS.length),
            empty: chatDecisionQueueOf([], 0),
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
        "chatbot.settings": {
            ready: { openclawTimeoutSec: 25, holdingMessage: "Please wait a moment.", updatedBy: "Thu Ha" },
        },
        "chatbot.thread": { ready: HANDLED_VIEW, waiting: WAITING_VIEW },
        "chatbot.messages": {
            ready: { rows: READY_LINES, cursor: null },
            empty: { rows: [], cursor: null },
            waiting: { rows: WAITING_LINES, cursor: null },
        },
    },
    actions: {
        "chatbot.reply": { ok: true, data: { messageId: "m9" } },
        "chatbot.handoff": { ok: true, data: { handledBy: "L\u00ea Thu H\u00e0" } },
        "chatbot.release": { ok: true, data: { handledBy: null } },
        "chatbot.approve-and-send": { ok: true, data: { messageId: "m8" } },
        "chatbot.reject-proposal": { ok: true },
        "chatbot.save-settings": { ok: true },
        "chatbot.decide": { ok: true, data: { handledBy: "L\u00ea Thu H\u00e0" } },
    },
}
