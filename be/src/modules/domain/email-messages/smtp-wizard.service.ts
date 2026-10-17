import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import { randomSecret } from "@modules/domain/connection-secrets"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectMail, MailError, renderEmail } from "@modules/integrations/mail"
import type { MailClient } from "@modules/integrations/mail"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { isMailAddress } from "./email-address.policy"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { EmailMessagesService } from "./email-messages.service"
import { EmailMessagesError, EmailMessagesErrorCode } from "./errors/email-messages.error"
import { smtpConfigOf } from "./smtp-config.policy"
import type { SmtpConnectionView, SmtpFormInput, SmtpTestInput, SmtpTestResult } from "./smtp-wizard.contracts"
import { cleanSmtpForm, cleanSmtpPassword, passwordOfParsed } from "./smtp-wizard.policy"

const FALLBACK_SHOP = "NIVO"

@Injectable()
/** The "Outgoing email" wizard: stores an SMTP connection as pending, proves it with a real test email, changes its password, picks the default. */
export class SmtpWizardService {
    constructor(
        @InjectMail() private readonly mail: MailClient,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
        private readonly log: EmailMessagesService,
        private readonly workspaces: WorkspacesService,
    ) {}

    /** Validates the form and stores the connection as pending; it turns connected only after a test email is sent. */
    async start(actor: ConnectionActor, input: SmtpFormInput): Promise<SmtpConnectionView> {
        await this.connections.authorize(actor, ["owner"])
        const verdict = cleanSmtpForm(input)
        if (!verdict.ok) throw new EmailMessagesError({ code: verdict.code })
        const form = verdict.form
        await this.mail.assertSmtpTarget(form.host, form.port)
        const id = await this.connections.create({
            workspaceId: actor.workspaceId,
            createdBy: actor.principalId,
            provider: "smtp",
            name: `${form.fromName} <${form.fromEmail}>`,
            status: "pending",
            environment: "live",
            meta: {
                preset: form.preset,
                host: form.host,
                port: String(form.port),
                security: form.security,
                user: form.user,
                from_name: form.fromName,
                from_email: form.fromEmail,
                reply_to: form.replyTo,
            },
            secret: { plain: JSON.stringify({ password: form.password }), webhookSecret: randomSecret() },
        })
        return { id, host: form.host, fromEmail: form.fromEmail, isDefault: false }
    }

    /** Sends a real test email; success marks the connection connected (and the default when the workspace has none), failure keeps the reason on it and throws. */
    async sendTest(actor: ConnectionActor, input: SmtpTestInput): Promise<SmtpTestResult> {
        await this.connections.authorize(actor, ["owner"])
        const connection = await this.own(actor.workspaceId, input.connectionId)
        const to = input.to.trim().toLowerCase()
        if (!isMailAddress(to)) throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpEmail })
        const password = await this.passwordOf(connection.id)
        const shop = (await this.workspaces.nameOf(actor.workspaceId)) || FALLBACK_SHOP
        const subject = this.catalog.get("email.test_subject", {}, "vi")
        const rendered = renderEmail({
            shopName: shop,
            title: subject,
            body: this.catalog.get("email.test_body", { shop }, "vi"),
            footer: this.catalog.get("email.test_footer", { shop }, "vi"),
            lang: "vi",
        })
        try {
            const sent = await this.mail.sendThroughSmtp(smtpConfigOf(connection.meta, password), {
                to,
                subject,
                html: rendered.html,
                text: rendered.text,
            })
            await this.record(actor.workspaceId, connection.id, to, subject, sent.messageId, null)
        } catch (cause) {
            const failure = this.mailText(cause)
            await this.record(actor.workspaceId, connection.id, to, subject, null, failure)
            await this.connections.patch(actor.workspaceId, connection.id, {
                status: connection.status === "pending" ? "pending" : "error",
                lastError: failure,
            })
            throw cause
        }
        await this.connections.patch(actor.workspaceId, connection.id, { status: "connected", lastError: null })
        const current = await this.connections.defaultSmtpId(actor.workspaceId)
        if (input.makeDefault || current === null) {
            await this.connections.setDefaultSmtp(actor.workspaceId, connection.id)
            return { to, isDefault: true }
        }
        return { to, isDefault: current === connection.id }
    }

    /** Replaces the stored password; the connection must be tested again before it is trusted. */
    async changePassword(actor: ConnectionActor, connectionId: string, password: string): Promise<void> {
        await this.connections.authorize(actor, ["owner"])
        const connection = await this.own(actor.workspaceId, connectionId)
        if (password.trim() === "") throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpPassword })
        const cleaned = cleanSmtpPassword(connection.meta.preset ?? "", password)
        await this.connections.writeSecret(connection.id, JSON.stringify({ password: cleaned }))
        await this.connections.patch(actor.workspaceId, connection.id, { status: "pending", lastError: null })
    }

    /** Makes one connected SMTP connection the workspace default sender. */
    async setDefault(actor: ConnectionActor, connectionId: string): Promise<void> {
        await this.connections.authorize(actor, ["owner"])
        const connection = await this.own(actor.workspaceId, connectionId, false)
        if (connection.status !== "connected") {
            throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpNotConnected })
        }
        await this.connections.setDefaultSmtp(actor.workspaceId, connection.id)
    }

    private async own(workspaceId: string, id: string, rejectDisconnected: boolean = true): Promise<ConnectionRecord> {
        const connection = await this.connections.find(workspaceId, id)
        if (
            connection === null ||
            connection.provider !== "smtp" ||
            (rejectDisconnected && connection.status === "disconnected")
        ) {
            throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpNone })
        }
        return connection
    }

    private async passwordOf(connectionId: string): Promise<string> {
        const secret = await this.connections.readSecret(connectionId)
        const password = secret === null ? null : this.passwordIn(connectionId, secret.plain)
        if (password === null) throw new EmailMessagesError({ code: EmailMessagesErrorCode.SmtpPassword })
        return password
    }

    private passwordIn(connectionId: string, credential: string): string | null {
        try {
            return passwordOfParsed(JSON.parse(credential))
        } catch (cause) {
            this.logger.error(EmailMessagesLogEvent.Undecryptable, cause, { connectionId })
            return null
        }
    }

    private record(
        workspaceId: string,
        connectionId: string,
        to: string,
        subject: string,
        messageId: string | null,
        error: string | null,
    ): Promise<string> {
        return this.log.record({
            workspaceId,
            connectionId,
            to,
            subject,
            purpose: "test",
            status: error === null ? "sent" : "failed",
            via: "workspace",
            providerMessageId: messageId,
            error,
            refs: {},
        })
    }

    private mailText(cause: unknown): string {
        return cause instanceof MailError
            ? this.catalog.get(`errors.${cause.code}`, {}, "vi")
            : this.catalog.get("errors.MAIL_UNKNOWN", {}, "vi")
    }
}
