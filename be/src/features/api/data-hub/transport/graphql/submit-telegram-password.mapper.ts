import type { TelegramLoginProgress } from "@modules/domain/data-hub"
import type { SubmitTelegramPasswordRequest } from "../../application/submit-telegram-password.contracts"
import type { SubmitTelegramPasswordInput } from "./dto/submit-telegram-password.input"
import type { TelegramLoginStageType } from "./dto/telegram-login-stage.type"

/** Maps the GraphQL arguments of submitTelegramPassword to the request. */
export const toSubmitTelegramPasswordRequest = (
    workspaceId: string,
    input: SubmitTelegramPasswordInput,
): SubmitTelegramPasswordRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    password: input.password,
})

/** Maps the answer of submitTelegramPassword to the GraphQL type. */
export const toSubmitTelegramPasswordType = (result: TelegramLoginProgress): TelegramLoginStageType => result
