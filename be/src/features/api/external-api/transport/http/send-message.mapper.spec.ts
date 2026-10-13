import { builder } from "@starci/jest-preset"
import type { SendMessageRequest } from "./dto/send-message.request"
import { toSendMessageRequest, toSendMessageResponse } from "./send-message.mapper"

const requestOf = builder<SendMessageRequest>({
    text: "Your booking is confirmed",
    conversation_id: "conversation-1",
    lead_id: "lead-1",
    require_approval: false,
})

describe("send message mapper", () => {
    it("maps the wire names and preserves both headers and an explicit false", () => {
        expect(toSendMessageRequest("Bearer nvk_1", "idem-1", requestOf())).toEqual({
            authorization: "Bearer nvk_1",
            idempotencyKey: "idem-1",
            text: "Your booking is confirmed",
            conversationId: "conversation-1",
            leadId: "lead-1",
            requireApproval: false,
        })
    })

    it("preserves absent headers and optional fields", () => {
        expect(toSendMessageRequest(undefined, undefined, { text: "Hello" })).toEqual({
            authorization: undefined,
            idempotencyKey: undefined,
            text: "Hello",
            conversationId: undefined,
            leadId: undefined,
            requireApproval: undefined,
        })
    })

    it("maps the queued conversation to the wire response", () => {
        expect(toSendMessageResponse({ conversationId: "conversation-1", status: "queued" })).toEqual({
            data: { conversation_id: "conversation-1", status: "queued" },
        })
    })
})
