import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { ModuleReadinessService } from "@modules/domain/modules"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    DailyOutcome,
    DeskConnections,
    DeskFeature,
    DeskRunStatus,
    ReviewTally,
} from "./accounting-desk.contracts"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway, PaymentCredit, RoleAnswer } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { bankCounts, buildDailySummary, dueLine } from "./daily-summary.policy"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { SUMMARY_COPY } from "./messages/accounting-desk.messages"
import { ReceivableReconcileService } from "./receivable-reconcile.service"
import { SupplierPaymentsService } from "./supplier-payments.service"
import { payablesDue, remindersToday, upcomingDues } from "./tax-calendar.policy"
import { suppliersOf, taxProfileOf } from "./tax-profile.policy"

const DAY_MS = 86_400_000
/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000
/** How far ahead the card and the reminders look. */
const HORIZON_DAYS = 30
/** The module whose workspaces get the morning run. */
const ACCOUNTING_MODULE = "accounting"
/** The verdicts of a morning whose workspace has no `invoice.list` tool: nothing was read, so nothing is counted. */
const NOT_REVIEWED: ReviewTally = { valid: 0, needsReview: 0, invalidTaxCode: 0, tool: null }

/** What the reconcile of one morning recorded, and the `receivable.find` tool that answered. */
interface Reconciled {
    /** The credits recorded on a receivable. */
    readonly recorded: number
    /** The `receivable.find` tool, or null when none answered. */
    readonly tool: string | null
}

/** The calendar day in Vietnam of an instant, `YYYY-MM-DD`. */
export const vnDayOf = (now: Date): string => new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

/** The optional features that will not run this morning because the workspace has no tool for their role. */
const notConnectedOf = (connected: DeskConnections): ReadonlyArray<DeskFeature> => [
    ...(connected.invoices ? [] : ["invoices" as const]),
    ...(connected.receivables ? [] : ["receivables" as const]),
]

@Injectable()
/**
 * N14 + N15 + N16 + N23, once a morning per workspace with the accounting agent. The run guard comes first: the installation is
 * settled against its required connections (`payment.credits.list`), and a workspace whose agent is not ready or live does not
 * run at all (the owner card comes from the installation status); nothing falls back to other data. Then the tax profile and the
 * suppliers come from the Second Brain, the day's e-invoices and payment credits from the workspace's tools by capability role;
 * the invoices are checked and the credits matched to the receivables their memos name, each only when the workspace has a tool
 * for that role (otherwise the card says it is not connected), and the `daily_summary` card (citing the tools that answered) and
 * the due-date reminders go to the accounting room.
 */
export class DeskDailyService {
    constructor(
        private readonly facts: BrainFactsService,
        private readonly installations: InstallationRecordsService,
        private readonly readiness: ModuleReadinessService,
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly review: EinvoiceReviewService,
        private readonly receivables: ReceivableReconcileService,
        private readonly supplierPayments: SupplierPaymentsService,
        private readonly room: AccountingRoomService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Runs the morning for every workspace with the accounting module. */
    async runAll(): Promise<number> {
        const workspaces = await this.installations.workspacesOf(ACCOUNTING_MODULE)
        await eachInOrder(workspaces, (workspaceId) => this.run(workspaceId))
        return workspaces.length
    }

    /** Checks the day's invoices and credits, then posts the card and the reminders due today; a blocked workspace does not run. */
    async run(workspaceId: string): Promise<DailyOutcome> {
        const blocked = await this.blocked(workspaceId)
        if (blocked !== null) return { status: blocked, card: null, reminders: 0 }
        const facts = await this.facts.list(workspaceId, { statuses: ["active"] })
        const profile = taxProfileOf(facts)
        if (profile === null) return { status: "no_tax_profile", card: null, reminders: 0 }
        const suppliers = suppliersOf(facts)
        const now = this.clock.now()
        const day = vnDayOf(now)
        const since = new Date(now.getTime() - DAY_MS)
        const connected = await this.gateway.connections(workspaceId)
        const reviewed = connected.invoices
            ? await this.review.review(workspaceId, profile, suppliers, since)
            : NOT_REVIEWED
        const { tool: invoiceTool, ...tally } = reviewed
        const credits = await this.gateway.listPaymentCredits(workspaceId, since.toISOString())
        const reconciled = connected.receivables
            ? await this.reconcileAll(workspaceId, credits)
            : { recorded: 0, tool: null }
        const payables = payablesDue(
            await this.supplierPayments.openPayables(workspaceId),
            suppliers,
            profile.supplierTermDays,
        )
        const upcoming = upcomingDues(profile, payables, day, HORIZON_DAYS)
        const tools = { invoices: invoiceTool, credits: credits.tool, receivables: reconciled.tool }
        const card = buildDailySummary({
            day,
            ...tally,
            ...bankCounts(credits.value, reconciled.recorded),
            upcoming,
            tools,
            notConnected: notConnectedOf(connected),
        })
        await this.room.postCard(workspaceId, card.hub, card.text)
        const due = remindersToday(upcoming, profile.reminderDays)
        await eachInOrder(due, (item) => this.room.post(workspaceId, SUMMARY_COPY.reminder(dueLine(item), item.note)))
        return { status: "ran", card, reminders: due.length }
    }

    /** Why the morning must not run for the workspace (no accounting installation, or an agent that is not ready), or null. */
    private async blocked(workspaceId: string): Promise<DeskRunStatus | null> {
        const installation = await this.installations.firstOfModule(workspaceId, ACCOUNTING_MODULE)
        if (installation === null) return "not_installed"
        const status = await this.readiness.settle(workspaceId, installation.id)
        if (status === "ready" || status === "live") return null
        return status === "needs_connection" ? "needs_connection" : "not_running"
    }

    /** Matches each unmatched credit to its receivable, in order; answers what was recorded and the tool that answered. */
    private async reconcileAll(
        workspaceId: string,
        credits: RoleAnswer<ReadonlyArray<PaymentCredit>>,
    ): Promise<Reconciled> {
        let recorded = 0
        let tool: string | null = null
        await eachInOrder(
            credits.value.filter((credit) => !credit.matched),
            async (credit) => {
                const outcome = await this.receivables.reconcile(workspaceId, credit, credits.tool)
                tool ??= outcome.tool
                if (outcome.kind === "recorded") recorded += 1
            },
        )
        return { recorded, tool }
    }
}
