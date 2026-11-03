import { mock } from "@starci/jest-preset"
import type { Mailer } from "@starci/mail"
import type { Logger } from "@modules/platform/logging"
import { MailLogEvent } from "./mail.log-events"
import type { MailOutboxService } from "./mail-outbox.service"
import { SuppressingMailer } from "./suppressing-mailer.service"

const message = { subject: "Confirm", text: "Open https://app.test/c?t=1", html: "<p>x</p>" }

const build = () => {
    const inner = mock<Mailer & { onModuleDestroy(): void }>()
    inner.send.mockResolvedValue({ messageId: "<real>", accepted: ["real@nivo.vn"] })
    const outbox = mock<MailOutboxService>()
    outbox.record.mockResolvedValue()
    const logger = mock<Logger>()
    const mailer = new SuppressingMailer(inner, ["*.example.test"], outbox, logger)
    return { mailer, inner, outbox, logger }
}

describe("SuppressingMailer", () => {
    it("holds back a message to a suppressed recipient, logs it masked, keeps it and answers success", async () => {
        const { mailer, inner, outbox, logger } = build()

        await expect(mailer.send({ to: "ada@a.example.test", message })).resolves.toEqual({
            messageId: "suppressed",
            accepted: [],
        })

        expect(inner.send).not.toHaveBeenCalled()
        expect(logger.info).toHaveBeenCalledWith(MailLogEvent.Suppressed, {
            recipient: "a***@a.example.test",
            reason: "suppress-list",
        })
        expect(outbox.record).toHaveBeenCalledWith("ada@a.example.test", "Confirm", message.text)
    })
    it("sends to a recipient that is off the list as it is", async () => {
        const { mailer, inner, outbox } = build()
        const request = { to: "real@nivo.vn", message }

        await expect(mailer.send(request)).resolves.toEqual({ messageId: "<real>", accepted: ["real@nivo.vn"] })

        expect(inner.send).toHaveBeenCalledWith({ ...request, to: ["real@nivo.vn"] })
        expect(outbox.record).not.toHaveBeenCalled()
    })
    it("sends a mixed message to the recipients off the list only", async () => {
        const { mailer, inner, outbox } = build()

        await mailer.send({ to: ["real@nivo.vn", "x@example.test"], message })

        expect(inner.send).toHaveBeenCalledWith({ to: ["real@nivo.vn"], message })
        expect(outbox.record).toHaveBeenCalledTimes(1)
    })
    it("goes on when the outbox cannot keep the message", async () => {
        const { mailer, outbox, logger } = build()
        const failure = new Error("disk full")
        outbox.record.mockRejectedValue(failure)

        await expect(mailer.send({ to: "x@example.test", message })).resolves.toMatchObject({ messageId: "suppressed" })

        expect(logger.error).toHaveBeenCalledWith(MailLogEvent.OutboxFailed, failure, {
            recipient: "x***@example.test",
        })
    })
    it("closes the connection of the real sender", () => {
        const { mailer, inner } = build()

        mailer.onModuleDestroy()

        expect(inner.onModuleDestroy).toHaveBeenCalledTimes(1)
    })
})
