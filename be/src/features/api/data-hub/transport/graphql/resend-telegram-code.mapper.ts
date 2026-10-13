import type { ResendTelegramCodeRequest } from "../../application/resend-telegram-code.contracts"
import type { ResendTelegramCodeInput } from "./dto/resend-telegram-code.input"

/** Maps the GraphQL arguments of resendTelegramCode to the request. */
export const toResendTelegramCodeRequest = (
    workspaceId: string,
    input: ResendTelegramCodeInput,
): ResendTelegramCodeRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})
