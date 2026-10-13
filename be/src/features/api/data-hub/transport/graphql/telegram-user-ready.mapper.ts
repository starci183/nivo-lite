import type { TelegramUserReadyRequest } from "../../application/telegram-user-ready.contracts"
import type { TelegramUserReadyType } from "./dto/telegram-user-ready.type"

/** Maps the GraphQL arguments of telegramUserReady to the request. */
export const toTelegramUserReadyRequest = (workspaceId: string): TelegramUserReadyRequest => ({
    workspaceId,
})

/** Maps the answer of telegramUserReady to the GraphQL type. */
export const toTelegramUserReadyType = (result: boolean): TelegramUserReadyType => ({ configured: result })
