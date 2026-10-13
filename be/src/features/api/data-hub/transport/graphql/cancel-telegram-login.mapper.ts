import type { CancelTelegramLoginRequest } from "../../application/cancel-telegram-login.contracts"
import type { CancelTelegramLoginInput } from "./dto/cancel-telegram-login.input"

/** Maps the GraphQL arguments of cancelTelegramLogin to the request. */
export const toCancelTelegramLoginRequest = (
    workspaceId: string,
    input: CancelTelegramLoginInput,
): CancelTelegramLoginRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})
