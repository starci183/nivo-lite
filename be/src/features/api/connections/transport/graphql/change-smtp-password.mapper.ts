import type { ChangeSmtpPasswordRequest } from "../../application/change-smtp-password.contracts"
import type { ChangeSmtpPasswordInput } from "./dto/change-smtp-password.input"

/** Maps the GraphQL arguments of changeSmtpPassword to the request. */
export const toChangeSmtpPasswordRequest = (workspaceId: string, input: ChangeSmtpPasswordInput): ChangeSmtpPasswordRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    password: input.password,
})
