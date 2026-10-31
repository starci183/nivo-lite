import type { GetTelegramPageRequest } from "../../application/get-telegram-page.contracts"
import type { TelegramPageView } from "@modules/domain/channels"
import type { GetTelegramPageInput } from "./dto/get-telegram-page.input"
import type { TelegramPageType } from "./dto/telegram-page.type"

/** Maps the GraphQL arguments of telegramPage to the request. */
export const toGetTelegramPageRequest = (workspaceId: string, input: GetTelegramPageInput): GetTelegramPageRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of telegramPage to the GraphQL type. */
export const toGetTelegramPageType = (result: TelegramPageView): TelegramPageType => ({
    ...result,
    agentIds: [...result.agentIds],
})
