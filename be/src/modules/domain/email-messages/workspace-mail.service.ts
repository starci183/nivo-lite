import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { InjectMail, MailError } from "@modules/integrations/mail"
import type { MailAttachment, MailClient, SmtpConfig } from "@modules/integrations/mail"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { MessageCatalog } from "@modules/platform/i18n"
import { fitsAttachmentLimit, mailAttachmentsOf } from "./attachments.policy"
import { isMailAddress } from "./email-address.policy"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { EmailMessagesService } from "./email-messages.service"
import type {
    EmailAudience,
    EmailVia,
    SendEmailFailure,
    SendEmailInput,
    SendEmailResult,
    SendEmailStatus,
} from "./email-messages.contracts"
import { chooseSmtp, smtpConfigOf } from "./smtp-config.policy"

/** Messages a workspace may send per hour: protects the owner's mailbox and NIVO's name. */
const HOURLY_LIMIT = 120
/** Owner notices a workspace may receive per day through the platform sender. */
const PLATFORM_DAILY_LIMIT = 20
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

interface Verdict {
    readonly connectionId?: string
    readonly messageId?: string
    readonly error?: string
    readonly failure?: SendEmailFailure
}

@Injectable()
/**
 * Sends one email for a workspace and records it. The connection is the one asked for, else the workspace default, else its oldest
 * connected one. With no SMTP at all an owner notice falls back to the platform sender; customer mail never does. Customer mail is
 * refused unless it carries the id of the work item whose authority gate approved it.
 */
export class WorkspaceMailService {
    constructor(
        @InjectMail() private readonly mail: MailClient,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly log: EmailMessagesService,
        private readonly connections: ConnectionsService,
    ) {}

    /** Sends the email. A refusal or a failure is an answer, never a throw: the attempt is recorded either way. */
    async send(input: SendEmailInput): Promise<SendEmailResult> {
        const audience: EmailAudience = input.audience ?? "customer"
        const to = input.to.trim()
        if (!isMailAddress(to))
            return this.done(input, to, "blocked", "none", { failure: "recipient", error: this.text("bad_recipient") })
        if (audience === "customer" && input.workItemId === undefined) {
            return this.done(input, to, "blocked", "none", { failure: "gate", error: this.text("gate") })
        }
        const sentLastHour = await this.log.sentSince(
            input.workspaceId,
            new Date(this.clock.now().getTime() - HOUR_MS),
            null,
        )
        if (sentLastHour >= HOURLY_LIMIT) {
            return this.done(input, to, "rate_limited", "none", { failure: "rate", error: this.text("rate") })
        }
        const files = mailAttachmentsOf(input.attachments ?? [])
        if (!fitsAttachmentLimit(files)) {
            return this.done(input, to, "blocked", "none", { failure: "attachment", error: this.text("attachment") })
        }
        const smtp = await this.smtpOf(input.workspaceId, input.connectionId)
        if (smtp !== null) return this.viaWorkspace(input, to, smtp.id, smtp.config, files)
        if (audience === "owner" && this.mail.hasPlatformSender()) return this.viaPlatform(input, to, files)
        return this.done(input, to, "no_smtp", "none", { failure: "no_smtp", error: this.text("no_smtp") })
    }

    /** True when the workspace can send customer-facing email: it has its own connected SMTP connection. */
    async hasWorkspaceSmtp(workspaceId: string): Promise<boolean> {
        return (await this.smtpOf(workspaceId, undefined)) !== null
    }

    private async viaWorkspace(
        input: SendEmailInput,
        to: string,
        connectionId: string,
        config: SmtpConfig,
        files: ReadonlyArray<MailAttachment>,
    ): Promise<SendEmailResult> {
        try {
            const sent = await this.mail.sendThroughSmtp(config, {
                to,
                subject: input.subject,
                html: input.html,
                text: input.text,
                attachments: files.length === 0 ? undefined : files,
            })
            return await this.done(input, to, "sent", "workspace", { connectionId, messageId: sent.messageId })
        } catch (cause) {
            return this.done(input, to, "failed", "workspace", {
                connectionId,
                failure: "mail",
                error: this.mailText(cause),
            })
        }
    }

    private async viaPlatform(
        input: SendEmailInput,
        to: string,
        files: ReadonlyArray<MailAttachment>,
    ): Promise<SendEmailResult> {
        const today = await this.log.sentSince(
            input.workspaceId,
            new Date(this.clock.now().getTime() - DAY_MS),
            "platform",
        )
        if (today >= PLATFORM_DAILY_LIMIT) {
            return this.done(input, to, "rate_limited", "platform", { failure: "rate", error: this.text("rate") })
        }
        try {
            const sent = await this.mail.sendThroughPlatform({
                to,
                subject: input.subject,
                html: input.html,
                text: input.text,
                attachments: files.length === 0 ? undefined : files,
            })
            return await this.done(input, to, "sent", "platform", { messageId: sent.messageId })
        } catch (cause) {
            return this.done(input, to, "failed", "platform", { failure: "mail", error: this.mailText(cause) })
        }
    }

    private async smtpOf(
        workspaceId: string,
        connectionId: string | undefined,
    ): Promise<{ id: string; config: SmtpConfig } | null> {
        const records = await this.connections.listByProvider(workspaceId, "smtp", { includeDisconnected: false })
        const connection = chooseSmtp(records, connectionId)
        if (connection === null) return null
        const secret = await this.connections.readSecret(connection.id)
        if (secret === null) return null
        const password = this.passwordOf(connection.id, secret.plain)
        return password === null ? null : { id: connection.id, config: smtpConfigOf(connection.meta, password) }
    }

    private async done(
        input: SendEmailInput,
        to: string,
        status: SendEmailStatus,
        via: EmailVia,
        verdict: Verdict = {},
    ): Promise<SendEmailResult> {
        const emailMessageId = await this.log.record({
            workspaceId: input.workspaceId,
            connectionId: verdict.connectionId ?? null,
            to,
            subject: input.subject,
            purpose: input.purpose,
            status,
            via,
            providerMessageId: verdict.messageId ?? null,
            error: verdict.error ?? null,
            refs: {
                ...input.refs,
                ...(input.workItemId === undefined ? {} : { work_item_id: input.workItemId }),
            },
        })
        return {
            status,
            via,
            emailMessageId,
            messageId: verdict.messageId,
            error: verdict.error,
            failure: verdict.failure,
        }
    }

    private text(key: string): string {
        return this.catalog.get(`email.err_${key}`, {}, "vi")
    }

    private mailText(cause: unknown): string {
        return cause instanceof MailError
            ? this.catalog.get(`errors.${cause.code}`, {}, "vi")
            : this.catalog.get("errors.MAIL_UNKNOWN", {}, "vi")
    }

    /** The password inside the sealed SMTP credential (a JSON object with a `password`), or null when it cannot be read. */
    private passwordOf(connectionId: string, credential: string): string | null {
        try {
            const parsed: unknown = JSON.parse(credential)
            const password: unknown =
                typeof parsed === "object" && parsed !== null ? Reflect.get(parsed, "password") : null
            return typeof password === "string" ? password : null
        } catch (cause) {
            this.logger.error(EmailMessagesLogEvent.Undecryptable, cause, { connectionId })
            return null
        }
    }
}
