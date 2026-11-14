import { listRead } from "@nivo-lite/agent-sdk/module"
import type { ListReadDefinition } from "@nivo-lite/agent-sdk/module"
import type { ListShape } from "@nivo-lite/agent-sdk/block"
import { customerMessagesPort, membersPort, routeHoldsPort } from "@nivo-lite/agent-sdk/platform"
import { CHAT_MARKS, CHATBOT_CHANNELS } from "../rules"
import type { ThreadRow } from "../chatbot.types"
import { THREADS_LIST } from "../ports"
import { withLastLines } from "./last-lines"
import { withHolders } from "./route-holder"

/** The inbox list: searched by name, narrowed by status, channel and the conversations that moved today, newest activity first. */
export const THREADS_SHAPE: ListShape = {
    search: { fields: ["name"] },
    filters: {
        status: { field: "status", op: "eq", of: CHAT_MARKS },
        channel: { field: "channel", op: "eq", of: CHATBOT_CHANNELS },
        moved: { field: "lastAt", op: "within", of: ["$today"] },
    },
    sort: { recent: [["lastAt", "desc"]] },
    page: { size: 30 },
    row: { id: "id", title: "name" },
}

/** The ports the inbox list joins its rows from: the engine's conversation, the engine's staff hold of each route and the members. */
const JOINED = { lines: customerMessagesPort, holds: routeHoldsPort, members: membersPort } as const

/**
 * The conversations of the inbox, each with the last line said on its route within its window (`lastText`, `lastRole`), joined from the
 * ENGINE's conversation (`platform.customer-messages`, ruling R26): the chat stores no copy of a line; and who holds each route with the
 * status shown (`handled` while a member holds it), joined from the ENGINE's staff hold (`platform.route-holds`, ruling R43). The `status`
 * filter narrows on the chat's stored mark (`needs` / `ai`): a held route is not a stored mark, so it is no filter of this list.
 */
export const THREADS: ListReadDefinition = listRead<ThreadRow, typeof JOINED>({
    id: "blocks-core.chatbot.api.chat.list",
    dataKind: "conversation",
    permission: "chatbot.view",
    fields: [
        "id",
        "name",
        "avatarUrl",
        "channel",
        "status",
        "handledBy",
        "routeId",
        "startedAt",
        "lastText",
        "lastRole",
        "lastAt",
        "unanswered",
    ],
    list: THREADS_SHAPE,
    source: THREADS_LIST,
    join: { ports: JOINED, rows: async ({ lines, holds, members }, rows) => withHolders(holds, members, await withLastLines(lines, rows)) },
})
