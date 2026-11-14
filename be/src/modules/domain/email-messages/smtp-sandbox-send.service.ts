import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import type { SmtpOutgoing, SmtpSendPort, SmtpSent } from "./smtp-send.contracts"
import { SMTP_SANDBOX_PROVIDER, SMTP_SEND_OPERATION } from "./smtp-sandbox.catalogue"
import { smtpAuthRefused, smtpRecipientRefused, smtpTimedOut } from "./smtp-sandbox.failures"

/** The digits of the running message id of an accepted mail. */
const ID_DIGITS = 6

@Injectable()
/**
 * The sandbox twin of the workspace SMTP send (`SMTP-1` .. `4`): the mail is RECORDED in the account's call log (to, subject, text, html,
 * the names of the attachments) and never delivered; the account needs no password. The account's next case answers: accepted (default,
 * a running message id `sbx-smtp-000001` and the accepted recipient), the recipient refused, the login refused, or no answer in time.
 * A failing case throws the SAME `MailError` the live relay throws for it.
 */
export class SmtpSandboxSendService implements SmtpSendPort {
    readonly provider = SMTP_SANDBOX_PROVIDER

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** Answers one send of a sandbox account from its next case; one logged call per send, holding the whole mail. */
    send(account: ConnectionRecord, _config: unknown, delivery: SmtpOutgoing): Promise<SmtpSent> {
        const { to, message } = delivery
        return this.sandbox.call(
            account,
            SMTP_SEND_OPERATION,
            {
                to,
                subject: message.subject,
                text: message.text,
                html: message.html ?? null,
                attachments: (message.attachments ?? []).map((file) => file.filename),
            },
            {
                key: to,
                answer: (state): SmtpSent => {
                    if (state.nextCase === "SMTP-2") throw smtpRecipientRefused()
                    if (state.nextCase === "SMTP-3") throw smtpAuthRefused()
                    if (state.nextCase === "SMTP-4") throw smtpTimedOut()
                    return { messageId: `sbx-smtp-${String(state.seq + 1).padStart(ID_DIGITS, "0")}`, accepted: [to] }
                },
            },
        )
    }
}
