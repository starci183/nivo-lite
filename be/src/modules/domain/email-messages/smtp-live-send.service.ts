import { Injectable } from "@nestjs/common"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectMailRelay, type MailRelayService, type SmtpConfig } from "@modules/integrations/mail"
import type { SmtpOutgoing, SmtpSendPort, SmtpSent } from "./smtp-send.contracts"

@Injectable()
/** The live send of a workspace SMTP account: the message leaves through the account's own mail server, as it always did. */
export class SmtpLiveSendService implements SmtpSendPort {
    readonly provider = "smtp"

    constructor(@InjectMailRelay() private readonly mail: MailRelayService) {}

    /** Sends through the account's server with its settings and password; a failure is the integration's `MailError`. */
    send(_account: ConnectionRecord, config: SmtpConfig, delivery: SmtpOutgoing): Promise<SmtpSent> {
        return this.mail.sendThroughSmtp(config, delivery)
    }
}
