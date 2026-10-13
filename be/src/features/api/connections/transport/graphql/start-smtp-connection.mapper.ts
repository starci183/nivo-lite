import type { StartSmtpConnectionRequest } from "../../application/start-smtp-connection.contracts"
import type { SmtpConnectionView } from "@modules/domain/email-messages"
import type { SmtpConnectionType } from "./dto/smtp-connection.type"
import type { StartSmtpConnectionInput } from "./dto/start-smtp-connection.input"

/** Maps the GraphQL arguments of startSmtpConnection to the request. */
export const toStartSmtpConnectionRequest = (
    workspaceId: string,
    input: StartSmtpConnectionInput,
): StartSmtpConnectionRequest => ({
    workspaceId,
    preset: input.preset,
    host: input.host,
    port: input.port,
    security: input.security,
    user: input.user,
    password: input.password,
    fromName: input.fromName,
    fromEmail: input.fromEmail,
    replyTo: input.replyTo,
})

/** Maps the answer of startSmtpConnection to the GraphQL type. */
export const toStartSmtpConnectionType = (result: SmtpConnectionView): SmtpConnectionType => result
