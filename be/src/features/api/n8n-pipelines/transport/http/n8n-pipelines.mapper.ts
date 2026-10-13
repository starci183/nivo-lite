import type { N8nCompletion, N8nEmailAnswer, N8nRawEmail } from "@modules/domain/n8n-runs"
import type { CompleteRunRequest } from "./dto/complete-run.request"
import type { SendEmailRequest } from "./dto/send-email.request"
import type { SendEmailResponse } from "./dto/send-email.response"

/** Maps the HTTP body of an email to the raw email the domain cleans. */
export const toRawEmail = (input: SendEmailRequest): N8nRawEmail => ({
    to: input.to,
    variables: input.variables,
    refs: input.refs,
    dedupe: input.dedupe,
    attachments: input.attachments,
})

/** Maps what happened to the email to the body the workflow counts. */
export const toSendEmailResponse = (result: N8nEmailAnswer): SendEmailResponse => ({
    status: result.status,
    via: result.via,
    work_item_id: result.workItemId,
    email_message_id: result.emailMessageId,
    message_id: result.messageId,
    error: result.error,
})

/** Maps the HTTP body of a completion to the report the domain closes the run with. */
export const toCompletion = (input: CompleteRunRequest): N8nCompletion => ({
    status: input.status,
    summary: input.summary,
    result: input.result,
})
