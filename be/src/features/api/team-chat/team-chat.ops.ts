import { NIVO_API } from "@nivo-lite/agent-sdk/names"
import type { NivoApiOpGroup } from "@modules/domain/nivo-api"
import { ChatMessagesHandler } from "./application/chat-messages.handler"
import { ChatMessagesQuery } from "./application/chat-messages.query"
import { ChatRoomsHandler } from "./application/chat-rooms.handler"
import { ChatRoomsQuery } from "./application/chat-rooms.query"

/** The /chat thread ops of the outbound MCP surface: the message each op sends to the team chat handlers, with those handlers. */
export const TEAM_CHAT_NIVO_API_OPS: NivoApiOpGroup = {
    handlers: [ChatRoomsHandler, ChatMessagesHandler],
    queries: {
        [NIVO_API.chatThread.list]: ChatRoomsQuery,
        [NIVO_API.chatThread.get]: ChatMessagesQuery,
    },
    commands: {},
}
