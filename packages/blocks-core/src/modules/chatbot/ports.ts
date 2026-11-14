import { entityPort } from "@nivo-lite/agent-sdk/entity/port"
import { definePort } from "@nivo-lite/agent-sdk/port"
import type { PortDefinition } from "@nivo-lite/agent-sdk/port"
import type { ListSource } from "@nivo-lite/agent-sdk/block"
import type { EntityApi } from "@nivo-lite/agent-sdk/entity/port"
import { conversationEntity } from "../../entities/chat/conversation.entity"
import { noteEntity } from "../../entities/chat/note.entity"
import { replyEntity } from "../../entities/chat/reply.entity"
import { chatSettingsEntity } from "../../entities/chat/settings.entity"
import type { ThreadRow } from "./chatbot.types"

/*
 * The data of the Chatbot module is the engine's: the conversations and the chatbot's notes are `blocks-core.chatbot.chat` and
 * `blocks-core.chatbot.note` records read and written through their entity ports; the lines of a conversation are the engine's
 * (`platform.customer-messages`, ruling R26), the member directory is the platform's, the outbox and the door are the engine's. Only the list source below is the module's own slot, the id every list read of a module has.
 */

/** The conversations list: the engine turns a list shape and a query into one query over `blocks-core.chatbot.chat`. */
export type ThreadsList = ListSource<ThreadRow>

/** The port of the conversations (`blocks-core.chatbot.chat`). */
export const CONVERSATIONS: PortDefinition<EntityApi> = entityPort(conversationEntity)

/** The port of the chatbot's notes on a conversation (`blocks-core.chatbot.note`). */
export const NOTES: PortDefinition<EntityApi> = entityPort(noteEntity)

/** The port of the replies a member typed, until the delivery job hands them to the engine (`blocks-core.chatbot.reply`). */
export const REPLIES: PortDefinition<EntityApi> = entityPort(replyEntity)

/** The port the inbox list runs on. */
export const THREADS_LIST: PortDefinition<ThreadsList> = definePort<ThreadsList>("chatbot.threads-list")

/** The port of the saved rules of the Chatbot (`blocks-core.chatbot.settings`, one record per workspace). */
export const SETTINGS: PortDefinition<EntityApi> = entityPort(chatSettingsEntity)
