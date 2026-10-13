import type { TelegramLoginStarted } from "@modules/domain/data-hub"
import type { StartTelegramLoginRequest } from "../../application/start-telegram-login.contracts"
import type { StartTelegramLoginInput } from "./dto/start-telegram-login.input"
import type { TelegramLoginStartedType } from "./dto/telegram-login-started.type"

/** Maps the GraphQL arguments of startTelegramLogin to the request. */
export const toStartTelegramLoginRequest = (
    workspaceId: string,
    input: StartTelegramLoginInput,
): StartTelegramLoginRequest => ({
    workspaceId,
    name: input.name,
    phone: input.phone,
    consent: input.consent,
    connectionId: input.connectionId,
})

/** Maps the answer of startTelegramLogin to the GraphQL type. */
export const toStartTelegramLoginType = (result: TelegramLoginStarted): TelegramLoginStartedType => result
