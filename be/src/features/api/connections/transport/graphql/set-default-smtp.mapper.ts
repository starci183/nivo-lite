import type { SetDefaultSmtpRequest } from "../../application/set-default-smtp.contracts"
import type { SetDefaultSmtpInput } from "./dto/set-default-smtp.input"

/** Maps the GraphQL arguments of setDefaultSmtp to the request. */
export const toSetDefaultSmtpRequest = (workspaceId: string, input: SetDefaultSmtpInput): SetDefaultSmtpRequest => ({
    workspaceId,
    connectionId: input.connectionId,
})
