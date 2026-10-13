import type { TelegramLoginProgress } from "@modules/domain/data-hub"
import type { SubmitTelegramCodeRequest } from "../../application/submit-telegram-code.contracts"
import type { SubmitTelegramCodeInput } from "./dto/submit-telegram-code.input"
import type { TelegramLoginStageType } from "./dto/telegram-login-stage.type"

/** Maps the GraphQL arguments of submitTelegramCode to the request. */
export const toSubmitTelegramCodeRequest = (
    workspaceId: string,
    input: SubmitTelegramCodeInput,
): SubmitTelegramCodeRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    code: input.code,
})

/** Maps the answer of submitTelegramCode to the GraphQL type. */
export const toSubmitTelegramCodeType = (result: TelegramLoginProgress): TelegramLoginStageType => result
