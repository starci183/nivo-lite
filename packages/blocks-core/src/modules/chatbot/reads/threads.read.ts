import { listRead, type ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import type { ListShape } from "@nivo-lite/agent-sdk/block"
import { CHATBOT_CHANNELS, INBOX_STATUSES } from "../../../rules/chatbot"
import type { ThreadRow } from "../chatbot.types"
import { THREADS_LIST } from "../ports"

/** The inbox list: searched by name and last words, narrowed by status, channel and the conversations that moved today, newest activity first. */
export const THREADS_SHAPE: ListShape = {
    search: { fields: ["name", "lastText"] },
    filters: {
        status: { field: "status", op: "eq", of: INBOX_STATUSES },
        channel: { field: "channel", op: "eq", of: CHATBOT_CHANNELS },
        moved: { field: "lastAt", op: "within", of: ["$today"] },
    },
    sort: { recent: [["lastAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name", description: "lastText" },
}

/** The conversations of the inbox. */
export const THREADS: ListReadDefinition = listRead<ThreadRow>({
    id: "chatbot.threads",
    dataKind: "conversation",
    permission: "chatbot.view",
    fields: [
        "id",
        "name",
        "avatarUrl",
        "channel",
        "status",
        "handledBy",
        "lastText",
        "lastRole",
        "lastAt",
        "unanswered",
        "messageCount",
    ],
    list: THREADS_SHAPE,
    source: THREADS_LIST,
})
