export { MAILER, escapeHtml, html, renderTransactional } from "@starci/mail"
export type { Mailer, MailAttachment, MailMessage, RenderedMail, SentMail } from "@starci/mail"
export { MAIL_ERROR_KINDS, MailError, MailErrorCode } from "./errors/mail.error"
export { MAIL_MESSAGES } from "./messages/mail.messages"
export { renderEmail } from "./mail-layout.policy"
export { parseMailConfig } from "./mail.config"
export type { MailDelivery, SmtpConfig } from "./mail.contracts"
export {
    InjectMailOutbox,
    InjectMailRelay,
    InjectMailSettings,
    InjectMailer,
    MAIL_OUTBOX,
    MAIL_RELAY,
    MAIL_SETTINGS,
} from "./mail.decorators"
export { MailModule } from "./mail.module"
export type { MailLanguage, MailOptions } from "./mail.options"
export type { MailRelayService } from "./mail-relay.service"
export type { MailOutboxService } from "./mail-outbox.service"
export type { OutboxEntry, OutboxQuery } from "./mail-outbox.policy"
