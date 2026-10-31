import type { ListTelegramEventsRequest } from "../../application/list-telegram-events.contracts"
import type { TelegramPageEvent } from "@modules/domain/channels"
import type { ListTelegramEventsInput } from "./dto/list-telegram-events.input"
import type { TelegramEventType } from "./dto/telegram-event.type"

/** Maps the GraphQL arguments of telegramEvents to the request. */
export const toListTelegramEventsRequest = (
    workspaceId: string,
    input: ListTelegramEventsInput,
): ListTelegramEventsRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of telegramEvents to the GraphQL type. */
export const toListTelegramEventsType = (result: ReadonlyArray<TelegramPageEvent>): Array<TelegramEventType> => [
    ...result,
]
