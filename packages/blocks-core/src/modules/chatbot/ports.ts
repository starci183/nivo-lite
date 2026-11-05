import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { conversationEntity } from "../../entities/chat/conversation.entity"
import { messageEntity } from "../../entities/chat/message.entity"
import type { ThreadRow } from "./chatbot.types"

/*
 * The data of the Chatbot module is the engine's: the conversations and the lines are `chat.conversation` and `chat.message`
 * records read and written through their entity ports, the member directory is the platform's, the outbox and the door are the
 * engine's. Only the list source below is the module's own slot, the id every list read of a module has.
 */

/** The conversations list: the engine turns a list shape and a query into one query over `chat.conversation`. */
export type ThreadsList = ListSource<ThreadRow>

/** The port of the conversations (`chat.conversation`). */
export const CONVERSATIONS: PortDefinition<EntityApi> = entityPort(conversationEntity)

/** The port of the lines (`chat.message`). */
export const MESSAGES: PortDefinition<EntityApi> = entityPort(messageEntity)

/** The port the inbox list runs on. */
export const THREADS_LIST: PortDefinition<ThreadsList> = definePort<ThreadsList>("chatbot.threads-list")
