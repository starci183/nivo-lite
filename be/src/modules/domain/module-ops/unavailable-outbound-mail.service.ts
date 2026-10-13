import { Injectable } from "@nestjs/common"
import type { MailResult } from "./module-ops.contracts"
import { OutboundMail } from "./outbound-mail.port"

@Injectable()
/** The mailer used until the mail capability is connected: it answers that the mail did not go out, so callers keep the message copy-ready. */
export class UnavailableOutboundMailService extends OutboundMail {
    /** Answers that the mail was not sent. */
    override send(): Promise<MailResult> {
        return Promise.resolve({ status: "failed", error: "unavailable" })
    }
}
