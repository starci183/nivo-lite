import { Test } from "@nestjs/testing"
import { REQUEST_RESULT } from "@modules/domain/intent-contracts"
import { requestProposalTextOf } from "./intent-request.policy"

const SUBJECT = Symbol("intent-request")
type RequestSubject = Pick<typeof import("./intent-request.policy"), "requestProposalTextOf">

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requestProposalTextOf } }],
    }).compile()
    return moduleRef.get<RequestSubject>(SUBJECT)
}

describe("requestProposalTextOf", () => {
    it("maps the one requested action without dropping its subject, fields, reply or tasks", async () => {
        const policy = await build()
        const request = {
            action: "send_invoice",
            subject: { type: "invoice", id: "invoice-1" },
            fields: { amount: 2000 },
            summary: "Send the invoice",
            reply: "The request is waiting.",
            tasks: [{ op: "add", key: "follow-up", title: "Follow up" }],
        }

        expect(policy.requestProposalTextOf(REQUEST_RESULT, JSON.stringify(request), request.action)).toBe(
            JSON.stringify({
                reply: request.reply,
                tasks: request.tasks,
                needsHuman: false,
                reason: "",
                actions: [
                    {
                        action: request.action,
                        subject: request.subject,
                        leadId: null,
                        fields: request.fields,
                        summary: request.summary,
                    },
                ],
            }),
        )
    })

    it("refuses invalid JSON and malformed request rows instead of losing a requested action silently", async () => {
        const policy = await build()

        expect(policy.requestProposalTextOf(REQUEST_RESULT, "not-json", "send_invoice")).toBeNull()
        expect(policy.requestProposalTextOf(REQUEST_RESULT, '{"reply":"Done"}', "send_invoice")).toBeNull()
        expect(
            policy.requestProposalTextOf(REQUEST_RESULT, '{"action":"send_invoice","extra":true}', "send_invoice"),
        ).toBeNull()
        expect(policy.requestProposalTextOf(REQUEST_RESULT, '{"action":"delete_invoice"}', "send_invoice")).toBeNull()
    })

    it("leaves the result of another domain to that domain's existing settler", async () => {
        const policy = await build()

        expect(policy.requestProposalTextOf("customer_reply", '{"reply":"Received"}', "reply_customer")).toBe(
            '{"reply":"Received"}',
        )
    })
})
