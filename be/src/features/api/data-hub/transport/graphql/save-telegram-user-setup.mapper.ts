import type { SaveTelegramUserSetupRequest } from "../../application/save-telegram-user-setup.contracts"
import type { SaveTelegramUserSetupInput } from "./dto/save-telegram-user-setup.input"

/** Maps the GraphQL arguments of saveTelegramUserSetup to the request. */
export const toSaveTelegramUserSetupRequest = (
    workspaceId: string,
    input: SaveTelegramUserSetupInput,
): SaveTelegramUserSetupRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    chats: input.chats,
    sinceDays: input.sinceDays,
    everyMinutes: input.everyMinutes,
})
