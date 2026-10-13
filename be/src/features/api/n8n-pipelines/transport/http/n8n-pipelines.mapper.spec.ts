import type { N8nEmailAnswer } from "@modules/domain/n8n-runs"
import type { CompleteRunRequest } from "./dto/complete-run.request"
import type { SendEmailRequest } from "./dto/send-email.request"
import { toCompletion, toRawEmail, toSendEmailResponse } from "./n8n-pipelines.mapper"

describe("n8n pipelines mapper", () => {
    describe("toRawEmail", () => {
        it("preserves every raw email field for the domain to clean", () => {
            const input: SendEmailRequest = {
                to: "customer@example.com",
                variables: { total: 120 },
                refs: { invoiceId: "invoice-1" },
                dedupe: "invoice-1:2026-10-12",
                attachments: [{ filename: "invoice.csv", content: "total\n120" }],
            }

            expect(toRawEmail(input)).toEqual({
                to: "customer@example.com",
                variables: { total: 120 },
                refs: { invoiceId: "invoice-1" },
                dedupe: "invoice-1:2026-10-12",
                attachments: [{ filename: "invoice.csv", content: "total\n120" }],
            })
        })

        it("preserves empty email fields and an omitted dedupe key", () => {
            const input: SendEmailRequest = { to: "owner@example.com", variables: {}, refs: {}, attachments: [] }

            expect(toRawEmail(input)).toEqual({
                to: "owner@example.com",
                variables: {},
                refs: {},
                dedupe: undefined,
                attachments: [],
            })
        })
    })

    describe("toSendEmailResponse", () => {
        it("renames the domain ids and preserves the delivery details", () => {
            const answer: N8nEmailAnswer = {
                status: "failed",
                via: "smtp",
                workItemId: "work-1",
                emailMessageId: "email-1",
                messageId: "message-1",
                error: "SMTP unavailable",
            }

            expect(toSendEmailResponse(answer)).toEqual({
                status: "failed",
                via: "smtp",
                work_item_id: "work-1",
                email_message_id: "email-1",
                message_id: "message-1",
                error: "SMTP unavailable",
            })
        })

        it("preserves null delivery fields", () => {
            const answer: N8nEmailAnswer = {
                status: "duplicate",
                via: null,
                workItemId: null,
                emailMessageId: null,
                messageId: null,
                error: null,
            }

            expect(toSendEmailResponse(answer)).toEqual({
                status: "duplicate",
                via: null,
                work_item_id: null,
                email_message_id: null,
                message_id: null,
                error: null,
            })
        })
    })

    describe("toCompletion", () => {
        it("preserves the workflow status, summary and result", () => {
            const input: CompleteRunRequest = { status: "done", summary: "One email sent", result: { sent: 1 } }

            expect(toCompletion(input)).toEqual({ status: "done", summary: "One email sent", result: { sent: 1 } })
        })

        it("leaves absent report fields undefined", () => {
            expect(toCompletion({})).toEqual({ status: undefined, summary: undefined, result: undefined })
        })
    })
})
