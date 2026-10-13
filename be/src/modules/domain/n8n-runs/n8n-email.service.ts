import { createHash } from "node:crypto"
import { Injectable } from "@nestjs/common"
import { N8nRunsError, N8nRunsErrorCode } from "./errors/n8n-runs.error"
import { N8nDataService } from "./n8n-data.service"
import type {
    MailOutcome,
    N8nEmailAnswer,
    N8nEmailRequest,
    N8nMailer,
    N8nRunContext,
    MailAudience,
} from "./n8n-runs.contracts"
import { InjectN8nMailer } from "./n8n-runs.decorators"
import { oneLine, renderTemplate } from "./policies/n8n-run.policy"

/** Which kind of email each workflow sends: the `purpose` the email log records. */
const PURPOSES: Readonly<Record<string, string>> = {
    "email-daily-report": "daily_report",
    "email-payment-receipt": "receipt",
    "email-debt-reminder": "debt_reminder",
    "email-month-ledger": "month_ledger",
}
const DEFAULT_PURPOSE = "pipeline"
const MONTH_LEDGER = "email-month-ledger"
const PAYMENT_RECEIPT = "email-payment-receipt"
const DEDUPE_MAX = 120
const DIGEST_LENGTH = 32

const answerOf = (outcome: MailOutcome): N8nEmailAnswer => ({
    status: outcome.status,
    via: outcome.via ?? null,
    workItemId: outcome.workItemId ?? null,
    emailMessageId: outcome.emailMessageId ?? null,
    messageId: outcome.messageId ?? null,
    error: outcome.error ?? null,
})

@Injectable()
/**
 * The emails the shared workflows ask for: the subject and the body come from the shop's approved template, the workflow supplies
 * only data. An owner-facing email goes only to an owner or manager of the workspace (or the accountant the owner typed in); a
 * customer-facing one always goes through the authority gate and the workspace's own mail account.
 */
export class N8nEmailService {
    constructor(
        @InjectN8nMailer() private readonly mailer: N8nMailer,
        private readonly data: N8nDataService,
    ) {}

    /** Renders and sends ONE email of a running workflow; `audience` says who may receive it. */
    async sendEmail(run: N8nRunContext, audience: MailAudience, request: N8nEmailRequest): Promise<N8nEmailAnswer> {
        const to = request.to.trim().toLowerCase()
        const subjectTemplate = typeof run.config.subject === "string" ? run.config.subject : ""
        const bodyTemplate = typeof run.config.body === "string" ? run.config.body : ""
        if (!to || !subjectTemplate || !bodyTemplate) throw new N8nRunsError({ code: N8nRunsErrorCode.EmailIncomplete })
        const subject = oneLine(renderTemplate(subjectTemplate, request.variables))
        const text = renderTemplate(bodyTemplate, request.variables)
        const purpose = PURPOSES[run.templateKey] ?? DEFAULT_PURPOSE
        const refs = { ...request.refs, run_id: run.runId }
        if (audience === "customer") {
            const dedupe = request.dedupe ? request.dedupe.slice(0, DEDUPE_MAX) : this.digest(to, request.refs, subject)
            return answerOf(
                await this.mailer.requestCustomerEmail({
                    workspaceId: run.workspaceId,
                    to,
                    subject,
                    body: text,
                    purpose,
                    refs,
                    dedupeKey: `send_email:${run.templateKey}:${dedupe}`,
                    subjectType: run.templateKey === PAYMENT_RECEIPT ? "transaction" : "invoice",
                    subjectId: this.idOf(request.refs),
                    leadId: typeof request.refs.lead_id === "string" ? request.refs.lead_id : null,
                }),
            )
        }
        const allowed = new Set((await this.data.ownerRecipients(run.workspaceId)).map((owner) => owner.email))
        const accountant =
            typeof run.config.accountant_email === "string" ? run.config.accountant_email.trim().toLowerCase() : ""
        if (run.templateKey === MONTH_LEDGER && accountant) allowed.add(accountant)
        if (!allowed.has(to)) throw new N8nRunsError({ code: N8nRunsErrorCode.RecipientBlocked })
        const shop = String(request.variables.ten_shop ?? "") || (await this.data.shopName(run.workspaceId))
        return answerOf(
            await this.mailer.sendOwnerEmail({
                workspaceId: run.workspaceId,
                to,
                subject,
                shopName: shop,
                text,
                attachments: request.attachments,
                purpose,
                refs,
            }),
        )
    }

    private idOf(refs: N8nEmailRequest["refs"]): string | null {
        if (typeof refs.transaction_id === "string") return refs.transaction_id
        return typeof refs.invoice_id === "string" ? refs.invoice_id : null
    }

    private digest(to: string, refs: N8nEmailRequest["refs"], subject: string): string {
        return createHash("sha256")
            .update(`${to}|${JSON.stringify(refs)}|${subject}`)
            .digest("hex")
            .slice(0, DIGEST_LENGTH)
    }
}
