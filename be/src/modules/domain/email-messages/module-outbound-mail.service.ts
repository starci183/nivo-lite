import { Injectable } from "@nestjs/common"
import { OutboundMail } from "@modules/domain/module-ops"
import type { MailNotice, MailResult } from "@modules/domain/module-ops"
import { WorkspacesService } from "@modules/domain/workspaces"
import { renderEmail } from "@modules/integrations/mail"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { Locale, MessageCatalog } from "@modules/platform/i18n"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { EmailMessagesLogEvent } from "./email-messages.log-events"
import { WorkspaceMailService } from "./workspace-mail.service"

/** The shop name a notice carries when the workspace has none. */
const DEFAULT_SHOP = "NIVO"
/** The business modules write their notices in Vietnamese. */
const NOTICE_LOCALE: Locale = "vi"
/** The failure code of a notice that could not be sent or recorded for an unexpected reason. */
const UNEXPECTED = "error"

@Injectable()
/**
 * The mailer of the business modules (hiring, shifts, inventory): renders the notice into the shop layout and sends it through
 * the workspace mail path, which picks the SMTP connection, applies the limits and records the attempt. It never throws.
 */
export class ModuleOutboundMailService extends OutboundMail {
    constructor(
        @InjectLogger() private readonly logger: Logger,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly mail: WorkspaceMailService,
        private readonly workspaces: WorkspacesService,
    ) {
        super()
    }

    /** Sends one notice; a refusal or a delivery failure answers `failed` with its code. */
    override async send(notice: MailNotice): Promise<MailResult> {
        try {
            const shop = await this.workspaces.nameOf(notice.workspaceId)
            const shopName = shop === "" ? DEFAULT_SHOP : shop
            const rendered = renderEmail({
                shopName,
                title: notice.title,
                body: notice.body,
                footer: this.catalog.get("email.notice_footer", { shop: shopName }, NOTICE_LOCALE),
                lang: NOTICE_LOCALE,
            })
            const sent = await this.mail.send({
                workspaceId: notice.workspaceId,
                to: notice.to,
                subject: notice.subject,
                html: rendered.html,
                text: rendered.text,
                purpose: notice.purpose,
                refs: notice.refs ?? {},
                audience: notice.audience,
                ...(notice.workItemId === undefined ? {} : { workItemId: notice.workItemId }),
                ...(notice.attachments === undefined ? {} : { attachments: notice.attachments }),
            })
            return sent.status === "sent"
                ? { status: "sent" }
                : { status: "failed", error: sent.failure ?? sent.status }
        } catch (cause) {
            this.logger.error(EmailMessagesLogEvent.NoticeFailed, cause, { purpose: notice.purpose })
            return { status: "failed", error: UNEXPECTED }
        }
    }
}
