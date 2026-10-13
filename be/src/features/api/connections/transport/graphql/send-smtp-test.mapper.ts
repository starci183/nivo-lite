import type { SendSmtpTestRequest } from "../../application/send-smtp-test.contracts"
import type { SmtpTestResult } from "@modules/domain/email-messages"
import type { SmtpTestResultType } from "./dto/smtp-test-result.type"
import type { SendSmtpTestInput } from "./dto/send-smtp-test.input"

/** Maps the GraphQL arguments of sendSmtpTest to the request. */
export const toSendSmtpTestRequest = (workspaceId: string, input: SendSmtpTestInput): SendSmtpTestRequest => ({
    workspaceId,
    connectionId: input.connectionId,
    to: input.to,
    makeDefault: input.makeDefault,
})

/** Maps the answer of sendSmtpTest to the GraphQL type. */
export const toSendSmtpTestType = (result: SmtpTestResult): SmtpTestResultType => result
