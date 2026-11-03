import type { Mailer, SendMailRequest, SentMail } from "@starci/mail"
import type { Logger } from "@modules/platform/logging"
import { MailLogEvent } from "./mail.log-events"
import type { MailOutboxService } from "./mail-outbox.service"
import { isSuppressed, maskAddress } from "./mail-suppress.policy"

/** The id a send answers when every recipient was held back. */
const SUPPRESSED_ID = "suppressed"

/**
 * The platform sender behind the `Mailer` port: a recipient on the suppress list never reaches the mail server. The message is logged
 * (the recipient masked), kept in the development outbox when one is configured, and the send answers success so the flow goes on.
 * A message with recipients both on and off the list goes to the ones off it.
 */
export class SuppressingMailer implements Mailer {
    constructor(
        private readonly inner: Mailer & { onModuleDestroy(): void },
        private readonly patterns: ReadonlyArray<string>,
        private readonly outbox: MailOutboxService,
        private readonly logger: Logger,
    ) {}

    /** Sends to the recipients off the list and holds back the rest. */
    async send(request: SendMailRequest): Promise<SentMail> {
        const recipients = typeof request.to === "string" ? [request.to] : request.to
        const held = recipients.filter((address) => isSuppressed(this.patterns, address))
        for (const address of held) await this.hold(address, request)
        const rest = recipients.filter((address) => !isSuppressed(this.patterns, address))
        if (rest.length === 0) return { messageId: SUPPRESSED_ID, accepted: [] }
        return this.inner.send({ ...request, to: rest })
    }

    /** Closes the connection of the real sender; the Nest module calls it at shutdown. */
    onModuleDestroy(): void {
        this.inner.onModuleDestroy()
    }

    private async hold(address: string, request: SendMailRequest): Promise<void> {
        this.logger.info(MailLogEvent.Suppressed, { recipient: maskAddress(address), reason: "suppress-list" })
        await this.outbox.record(address, request.message.subject, request.message.text).catch((cause: unknown) => {
            this.logger.error(MailLogEvent.OutboxFailed, cause, { recipient: maskAddress(address) })
        })
    }
}
