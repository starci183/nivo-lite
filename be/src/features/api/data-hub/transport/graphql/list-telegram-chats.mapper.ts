import type { TelegramChatChoice } from "@modules/domain/data-hub"
import type { ListTelegramChatsRequest } from "../../application/list-telegram-chats.contracts"
import type { ListTelegramChatsInput } from "./dto/list-telegram-chats.input"
import type { TelegramChatChoiceType } from "./dto/telegram-chat-choice.type"

/** Maps the GraphQL arguments of listTelegramChats to the request. */
export const toListTelegramChatsRequest = (
    workspaceId: string,
    input: ListTelegramChatsInput,
): ListTelegramChatsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of listTelegramChats to the GraphQL type. */
export const toListTelegramChatsType = (
    result: ReadonlyArray<TelegramChatChoice>,
): ReadonlyArray<TelegramChatChoiceType> => result
