import type { SendMessageRequest, SendMessageResult } from "../../application/send-message.contracts"
import type { SendMessageRequest as SendMessageHttpRequest } from "./dto/send-message.request"
import type { SendMessageResponse } from "./dto/send-message.response"

/** Maps the HTTP request and the Idempotency-Key header to the command request. */
export const toSendMessageRequest = (
    authorization: string | undefined,
    idempotencyKey: string | undefined,
    input: SendMessageHttpRequest,
): SendMessageRequest => ({
    authorization,
    text: input.text,
    conversationId: input.conversation_id,
    leadId: input.lead_id,
    requireApproval: input.require_approval,
    idempotencyKey,
})

/** Maps the command result to the HTTP response. */
export const toSendMessageResponse = (result: SendMessageResult): SendMessageResponse => ({
    data: { conversation_id: result.conversationId, status: result.status },
})
