import type { ConnectionRecord } from "@modules/domain/connections"
import type { MailMessage, SentMail, SmtpConfig } from "@modules/integrations/mail"

/** One message and the mailbox it goes to, as a workspace SMTP account sends it. */
export interface SmtpOutgoing {
    /** The recipient. */
    readonly to: string
    /** The subject, the bodies and the attachments. */
    readonly message: MailMessage
}

/** What the account's mail server answered for an accepted message: its message id and the recipients it accepted. */
export type SmtpSent = SentMail

/**
 * The send of one workspace SMTP account, resolved by `SmtpSendRegistryService.portFor(account)` (THE ONE SWITCH): the live port sends
 * through the account's own mail server; the sandbox port only records the mail in the account's call log. A refusal or a failure is
 * thrown as the integration's own `MailError`.
 */
export interface SmtpSendPort {
    /** The provider key of the account (`smtp`, as `connections.provider` names it). */
    readonly provider: string
    /** Sends one message for the account; `config` carries the account's settings, with no password for a sandbox account. */
    send(account: ConnectionRecord, config: SmtpConfig, delivery: SmtpOutgoing): Promise<SmtpSent>
}
