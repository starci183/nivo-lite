import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { Injectable } from "@nestjs/common"
import nodemailer from "nodemailer"
import { parseConnectionUrl } from "nodemailer/lib/shared"
import type SMTPTransport from "nodemailer/lib/smtp-transport"
import wellKnown from "nodemailer/lib/well-known"
import { MailError, MailErrorCode } from "./errors/mail.error"
import { oneLine, renderEmail } from "./mail-layout.policy"
import { InjectMailOptions } from "./mail.decorators"
import type { AcceptedInfo, EmailLayoutInput, MailMessage, SentMail, SmtpConfig } from "./mail.contracts"
import type { MailOptions } from "./mail.options"
import { classifySmtpFailure } from "./smtp-error.policy"
import { isPrivateAddress, isWellFormedHost } from "@modules/platform/primitives"
import { isValidPort, PUBLIC_MAIL_PORTS } from "./smtp-target.policy"

/** The attachments in the shape nodemailer takes. */
const attachmentsOf = (message: MailMessage) => message.attachments?.map((attachment) => ({ ...attachment }))

@Injectable()
/** The one owner of nodemailer: every message leaves through a workspace SMTP account or the platform sender. */
export class MailClient {
    constructor(@InjectMailOptions() private readonly options: MailOptions) {}

    /** True when the deployment has a platform sender, used for owner-facing notices only. */
    hasPlatformSender(): boolean {
        return this.options.platform !== null
    }

    /** The host is chosen by the workspace owner: it must be a public mail server on a mail port, never an address inside our network. */
    async assertSmtpTarget(host: string, port: number): Promise<void> {
        if (!isWellFormedHost(host)) throw new MailError({ code: MailErrorCode.Dns, params: { detail: host } })
        if (!isValidPort(port)) throw new MailError({ code: MailErrorCode.Connect, params: { detail: `port ${port}` } })
        if (this.options.allowPrivateHosts) return
        if (!PUBLIC_MAIL_PORTS.has(port)) {
            throw new MailError({ code: MailErrorCode.Connect, params: { detail: `port ${port} is not a mail port` } })
        }
        const addresses = await this.addressesOf(host)
        if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
            throw new MailError({ code: MailErrorCode.Connect, params: { detail: "private address" } })
        }
    }

    /** Sends one message through a workspace SMTP account. Throws a MailError. */
    async sendThroughSmtp(config: SmtpConfig, message: MailMessage): Promise<SentMail> {
        await this.assertSmtpTarget(config.host, config.port)
        const relaxed = this.options.allowPrivateHosts
        const transport = nodemailer.createTransport({
            ...this.transportOptions(config),
            secure: config.security === "tls",
            requireTLS: config.security === "starttls" && !relaxed,
            // Only the development mail catcher may use a self-signed certificate.
            tls: { rejectUnauthorized: !relaxed, minVersion: "TLSv1.2" },
        })
        return transport
            .sendMail({
                from: { name: config.fromName, address: config.fromEmail },
                replyTo: config.replyTo === "" ? undefined : config.replyTo,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
                attachments: attachmentsOf(message),
            })
            .then(
                (info) => this.accepted(info),
                (cause: unknown) => {
                    throw classifySmtpFailure(cause)
                },
            )
            .finally(() => {
                transport.close()
            })
    }

    /** Sends one owner notice through the platform sender. Throws a MailError. */
    sendThroughPlatform(message: MailMessage): Promise<SentMail> {
        const platform = this.options.platform
        if (platform === null) return Promise.reject(new MailError({ code: MailErrorCode.NotConfigured }))
        const { service, url: _url, ...parsed } = parseConnectionUrl(platform.url.reveal())
        const preset = service === undefined ? false : wellKnown(service)
        const resolved = { ...parsed, ...preset }
        const relaxed = this.options.allowPrivateHosts
        const transport = nodemailer.createTransport({
            ...resolved,
            port: resolved.port === undefined ? undefined : Number(resolved.port),
            // URL and service options are resolved before enforcing the transport policy.
            secure: resolved.secure === true || (resolved.secure === undefined && Number(resolved.port) === 465),
            requireTLS: !relaxed,
            ignoreTLS: false,
            opportunisticTLS: false,
            secured: false,
            sendmail: false,
            streamTransport: false,
            jsonTransport: false,
            tls: {
                ...resolved.tls,
                rejectUnauthorized: !relaxed,
                minVersion: resolved.tls?.minVersion === "TLSv1.3" ? "TLSv1.3" : "TLSv1.2",
            },
        })
        return transport
            .sendMail({
                from: platform.from,
                to: message.to,
                subject: message.subject,
                html: message.html,
                text: message.text,
                attachments: attachmentsOf(message),
            })
            .then(
                (info): SentMail => ({ messageId: info.messageId }),
                (cause: unknown) => {
                    throw classifySmtpFailure(cause)
                },
            )
            .finally(() => {
                transport.close()
            })
    }

    /** Sends an owner notice through the platform sender, wrapped in the shop layout; the subject is the title on one line. Throws a MailError. */
    sendNoticeThroughPlatform(to: string, notice: EmailLayoutInput): Promise<SentMail> {
        const rendered = renderEmail(notice)
        return this.sendThroughPlatform({
            to,
            subject: oneLine(notice.title),
            html: rendered.html,
            text: rendered.text,
        })
    }

    private accepted(info: AcceptedInfo): SentMail {
        if (info.rejected.length > 0) {
            throw new MailError({ code: MailErrorCode.Recipient, params: { detail: String(info.rejected[0]) } })
        }
        return { messageId: info.messageId }
    }

    private addressesOf(host: string): Promise<ReadonlyArray<string>> {
        if (isIP(host) !== 0) return Promise.resolve([host])
        return lookup(host, { all: true }).then(
            (records) => records.map((record) => record.address),
            (cause: unknown) => {
                throw new MailError({ code: MailErrorCode.Dns, params: { detail: host }, cause })
            },
        )
    }

    private transportOptions(config: SmtpConfig): SMTPTransport.Options {
        return {
            host: config.host,
            port: config.port,
            auth: config.user !== "" || config.pass !== "" ? { user: config.user, pass: config.pass } : undefined,
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 25_000,
            name: this.options.helloName,
        }
    }
}
