import { mock } from "@starci/jest-preset"
import type { N8nDoorService, N8nEmailAnswer, N8nRawEmail } from "@modules/domain/n8n-runs"
import type { Logger } from "@modules/platform/logging"
import { SendEmailCommand } from "./send-email.command"
import { SendEmailHandler } from "./send-email.handler"

const EMAIL: N8nRawEmail = {
    to: "customer@example.com",
    variables: { name: "Customer", total: 100000 },
    refs: { invoice_id: "invoice-1" },
    dedupe: "invoice-1:2026-10-12",
    attachments: [{ filename: "invoice.csv", content: "amount\n100000" }],
}
const ANSWER: N8nEmailAnswer = {
    status: "sent",
    via: "smtp",
    workItemId: "work-1",
    emailMessageId: "email-1",
    messageId: "message-1",
    error: null,
}

const build = () => {
    const logger = mock<Logger>()
    const door = mock<N8nDoorService>()
    const handler = new SendEmailHandler(logger, door)
    const message = new SendEmailCommand({ request: { authorization: "Bearer run-token", email: EMAIL } })
    return { logger, door, handler, message }
}

describe("SendEmailHandler", () => {
    it("passes the bearer and complete raw email to the door and returns the exact answer", async () => {
        const { logger, door, handler, message } = build()
        door.sendEmail.mockResolvedValue(ANSWER)

        await expect(handler.execute(message)).resolves.toEqual(ANSWER)

        expect(door.sendEmail).toHaveBeenCalledTimes(1)
        expect(door.sendEmail).toHaveBeenCalledWith("Bearer run-token", EMAIL)
        expect(logger.error).not.toHaveBeenCalled()
    })

    it("logs and rethrows the door failure", async () => {
        const { logger, door, handler, message } = build()
        const failure = new Error("Email failed")
        door.sendEmail.mockRejectedValue(failure)

        await expect(handler.execute(message)).rejects.toBe(failure)

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(logger.error).toHaveBeenCalledWith("cqrs.operation.failed", failure, {
            operation: "SendEmailHandler",
        })
    })
})
