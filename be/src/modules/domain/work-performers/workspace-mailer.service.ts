import { Injectable } from "@nestjs/common"
import { WorkEngineService } from "@modules/domain/decisions"
import { EmailMessagesService, WorkspaceMailService, isMailAddress } from "@modules/domain/email-messages"
import { InjectMessageCatalog, type Locale, type MessageCatalog } from "@modules/platform/i18n"
import type { CustomerEmail, MailOutcome, WorkspaceMailer } from "./workspace-mailer.contracts"

/** The language of the owner layout and of the waiting decision. */
const LOCALE: Locale = "vi"
/** Who the decision of a customer email names as the actor. */
const ACTOR = "NIVO"
const SUBJECT_MAX = 200
const SUMMARY_SUBJECT_MAX = 120

/** The subject as one line of at most `max` characters. */
const oneLine = (text: string, max: number): string =>
    text
        .replaceAll(/[\r\n]+/gu, " ")
        .trim()
        .slice(0, max)

@Injectable()
/**
 * The mail of the product. A customer email is the only way to reach a customer by mail: it becomes
 * a `send_email` work item and the owner's authority gate decides; `auto` sends now, `ask` keeps the draft waiting in Decisions. A
 * workspace without its own SMTP connection cannot mail customers at all, so nothing is queued and the attempt is recorded as no_smtp.
 */
export class WorkspaceMailerService implements WorkspaceMailer {
    constructor(
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly mail: WorkspaceMailService,
        private readonly log: EmailMessagesService,
        private readonly engine: WorkEngineService,
    ) {}

    /** Asks for a customer email through the gate; one request per business event, so a retry never sends twice. */
    async requestCustomerEmail(email: CustomerEmail): Promise<MailOutcome> {
        const to = email.to.trim()
        if (!isMailAddress(to)) return this.refused(email, to, "blocked", "bad_recipient")
        if (!(await this.mail.hasWorkspaceSmtp(email.workspaceId))) return this.refused(email, to, "no_smtp", "no_smtp")
        const subject = oneLine(email.subject, SUBJECT_MAX)
        const item = await this.engine.runWork(
            { workspaceId: email.workspaceId, actor: ACTOR, locale: LOCALE },
            {
                action: "send_email",
                subject_type: email.subjectType,
                subject_id: email.subjectId,
                lead_id: email.leadId,
                dedupeKey: email.dedupeKey,
                preset: true,
                noChain: true,
                seed: {
                    summary: this.catalog.get(
                        "performers.emailRequestSummary",
                        { to, subject: oneLine(email.subject, SUMMARY_SUBJECT_MAX) },
                        LOCALE,
                    ),
                    draft: email.body,
                    fields: { contact: to, subject, purpose: email.purpose, refs: JSON.stringify(email.refs) },
                },
            },
        )
        if (item.status === "done") return { status: "sent", workItemId: item.id }
        if (item.status === "failed") return { status: "failed", workItemId: item.id, error: item.error }
        if (item.status !== "waiting_decision") return { status: "duplicate", workItemId: item.id }
        if (!(await this.log.isWaitingFor(email.workspaceId, item.id))) {
            await this.log.record({
                workspaceId: email.workspaceId,
                connectionId: null,
                to,
                subject,
                purpose: email.purpose,
                status: "waiting_decision",
                via: "none",
                providerMessageId: null,
                error: null,
                refs: { ...email.refs, work_item_id: item.id },
            })
        }
        return { status: "waiting_decision", workItemId: item.id }
    }

    private async refused(
        email: CustomerEmail,
        to: string,
        status: "blocked" | "no_smtp",
        reason: string,
    ): Promise<MailOutcome> {
        const error = this.catalog.get(`email.err_${reason}`, {}, LOCALE)
        const emailMessageId = await this.log.record({
            workspaceId: email.workspaceId,
            connectionId: null,
            to,
            subject: oneLine(email.subject, SUBJECT_MAX),
            purpose: email.purpose,
            status,
            via: "none",
            providerMessageId: null,
            error,
            refs: email.refs,
        })
        return { status, via: "none", emailMessageId, error }
    }
}
