import type { ConnectTelegramRequest } from "../../application/connect-telegram.contracts"
import type { TelegramConnected } from "@modules/domain/channel-connections"
import type { ConnectTelegramInput } from "./dto/connect-telegram.input"
import type { TelegramConnectedType } from "./dto/telegram-connected.type"

/** Maps the GraphQL arguments of connectTelegram to the request. */
export const toConnectTelegramRequest = (workspaceId: string, input: ConnectTelegramInput): ConnectTelegramRequest => ({
    workspaceId,
    name: input.name,
    token: input.token,
})

/** Maps the answer of connectTelegram to the GraphQL type. */
export const toConnectTelegramType = (result: TelegramConnected): TelegramConnectedType => ({
    connection: { ...result.connection, agentIds: [], grants: [] },
    webhookRegistered: result.webhookRegistered,
})
