import { Injectable } from "@nestjs/common"
import { assertSmtpTarget } from "@starci/mail"
import type { Mailer, MailOptions as MailerOptions, MailSecurity, SentMail } from "@starci/mail"
import { InjectMailSettings, InjectMailer, InjectMailerFactory } from "./mail.decorators"
import type { MailerFactory } from "./mail.decorators"
import type { MailDelivery, SmtpConfig } from "./mail.contracts"
import { mailErrorOf } from "./mail-error.policy"
import type { MailOptions } from "./mail.options"

@Injectable()
/**
 * Sends the mail that leaves through a server the product does not own: a workspace's own SMTP account (its host chosen by the
 * workspace owner, so it must be a public mail server unless the site is a development one) and the platform sender for owner
 * notices. Every failure is the integration's own coded error.
 */
export class MailRelayService {
    constructor(
        @InjectMailSettings() private readonly settings: MailOptions,
        @InjectMailerFactory() private readonly mailers: MailerFactory,
        @InjectMailer() private readonly platform: Mailer,
    ) {}

    /** The host is chosen by the workspace owner: it must be a public mail server on a mail port, never an address inside our network. */
    async assertSmtpTarget(host: string, port: number): Promise<void> {
        await assertSmtpTarget(host, port, { allowPrivate: this.settings.allowPrivateHosts }).then(
            () => undefined,
            (cause: unknown) => {
                throw mailErrorOf(cause)
            },
        )
    }

    /** Sends one message through a workspace SMTP account. Throws a MailError. */
    sendThroughSmtp(config: SmtpConfig, delivery: MailDelivery): Promise<SentMail> {
        const mailer = this.mailers.create(this.optionsOf(config))
        return mailer
            .send(delivery)
            .catch((cause: unknown) => {
                throw mailErrorOf(cause)
            })
            .finally(() => {
                mailer.onModuleDestroy()
            })
    }

    /** Sends one owner notice through the platform sender. Throws a MailError. */
    async sendThroughPlatform(delivery: MailDelivery): Promise<SentMail> {
        try {
            return await this.platform.send(delivery)
        } catch (cause) {
            throw mailErrorOf(cause)
        }
    }

    private optionsOf(config: SmtpConfig): MailerOptions {
        const relaxed = this.settings.allowPrivateHosts
        const login = config.user !== "" || config.pass !== ""
        return {
            host: config.host,
            port: config.port,
            security: this.securityOf(config, login),
            ...(login ? { auth: { user: config.user, pass: config.pass } } : {}),
            from: { name: config.fromName, address: config.fromEmail },
            ...(config.replyTo === undefined || config.replyTo === "" ? {} : { replyTo: config.replyTo }),
            ...(this.settings.helloName === undefined ? {} : { helloName: this.settings.helloName }),
            // Only the development mail catcher may use a self-signed certificate.
            allowSelfSigned: relaxed,
            publicTargetOnly: !relaxed,
        }
    }

    /** An implicit TLS port stays TLS; a development catcher that takes mail with no login may be reached without encryption. */
    private securityOf(config: SmtpConfig, login: boolean): MailSecurity {
        if (config.security === "tls") return "tls"
        return this.settings.allowPrivateHosts && !login ? "none" : "starttls"
    }
}
