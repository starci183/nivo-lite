import type { TelegramSetupState } from "@modules/domain/data-hub"
import type { LoadTelegramUserSetupRequest } from "../../application/load-telegram-user-setup.contracts"
import type { LoadTelegramUserSetupInput } from "./dto/load-telegram-user-setup.input"
import type { TelegramSetupStateType } from "./dto/telegram-setup-state.type"

/** Maps the GraphQL arguments of loadTelegramUserSetup to the request. */
export const toLoadTelegramUserSetupRequest = (
    workspaceId: string,
    input: LoadTelegramUserSetupInput,
): LoadTelegramUserSetupRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})

/** Maps the answer of loadTelegramUserSetup to the GraphQL type. */
export const toLoadTelegramUserSetupType = (result: TelegramSetupState): TelegramSetupStateType => result
