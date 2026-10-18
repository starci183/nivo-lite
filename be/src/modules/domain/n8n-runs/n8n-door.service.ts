import { Injectable } from "@nestjs/common"
import { AutomationTemplatesService } from "@modules/domain/automation-templates"
import { N8nRunsError, N8nRunsErrorCode } from "./errors/n8n-runs.error"
import { N8nDataService } from "./n8n-data.service"
import { N8nEmailService } from "./n8n-email.service"
import type {
    DaySummary,
    RunAuthorization,
    MonthLedger,
    N8nCompletion,
    N8nEmailAnswer,
    N8nRawEmail,
    N8nRunContext,
    OverdueInvoices,
} from "./n8n-runs.contracts"
import { N8nRunsService } from "./n8n-runs.service"
import { attachmentsOf, refsOf, scalars } from "./policies/n8n-run.policy"

const DAILY_REPORT = "email-daily-report"
const DEBT_REMINDER = "email-debt-reminder"
const MONTH_LEDGER = "email-month-ledger"

@Injectable()
/**
 * What the shared workflows may ask of NIVO, each proved by the bearer token of ITS run: one run speaks for one workspace and one
 * workflow, so a leaked token reaches nothing else, and it stops working when the run is closed.
 */
export class N8nDoorService {
    constructor(
        private readonly runs: N8nRunsService,
        private readonly data: N8nDataService,
        private readonly email: N8nEmailService,
        private readonly templates: AutomationTemplatesService,
    ) {}

    /** The figures of a day (today when `date` is empty) and the owners to mail, for the daily report workflow. */
    async daySummary(authorization: RunAuthorization, date: string): Promise<DaySummary> {
        const run = await this.workflowRun(authorization, DAILY_REPORT)
        return this.data.dailySummary(run.workspaceId, date || null)
    }

    /** The overdue invoices a debt reminder workflow mails about. */
    async overdueInvoices(authorization: RunAuthorization): Promise<OverdueInvoices> {
        const run = await this.workflowRun(authorization, DEBT_REMINDER)
        return this.data.overdueInvoices(run.workspaceId, run.config)
    }

    /** A month of the ledger (last month when `period` is empty) for the accountant workflow. */
    async monthLedger(authorization: RunAuthorization, period: string): Promise<MonthLedger> {
        const run = await this.workflowRun(authorization, MONTH_LEDGER)
        return this.data.monthLedger(run.workspaceId, period || null)
    }

    /** Sends ONE email of the running workflow; the template says whether it goes to an owner or to a customer. */
    async sendEmail(authorization: RunAuthorization, raw: N8nRawEmail): Promise<N8nEmailAnswer> {
        const run = await this.runOf(authorization, undefined)
        const audience = (await this.templates.templateOf(run.templateKey)).n8n?.audience
        if (audience === undefined) throw new N8nRunsError({ code: N8nRunsErrorCode.WorkflowMismatch })
        return this.email.sendEmail(run, audience, {
            to: raw.to,
            variables: scalars(raw.variables),
            refs: refsOf(raw.refs),
            dedupe: raw.dedupe,
            attachments: attachmentsOf(raw.attachments),
        })
    }

    /** Closes the run with how it ended; the token stops working right after. */
    async completeRun(authorization: RunAuthorization, runId: string, report: N8nCompletion): Promise<void> {
        await this.runs.completeRun(await this.runOf(authorization, runId), report)
    }

    private async runOf(authorization: RunAuthorization, runId: string | undefined): Promise<N8nRunContext> {
        return this.runs.requireRun(await this.runs.verifyRun({ authorization, expectedRunId: runId }))
    }

    private async workflowRun(authorization: RunAuthorization, templateKey: string): Promise<N8nRunContext> {
        return this.runs.requireWorkflow(
            await this.runs.verifyRun({ authorization, expectedRunId: undefined }),
            templateKey,
        )
    }
}
