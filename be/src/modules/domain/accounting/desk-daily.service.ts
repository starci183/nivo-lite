import { Injectable } from "@nestjs/common"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import type { DailyOutcome } from "./accounting-desk.contracts"
import { InjectAccountingGateway } from "./accounting-gateway.decorators"
import type { AccountingGateway } from "./accounting-gateway.port"
import { AccountingRoomService } from "./accounting-room.service"
import { bankCounts, buildDailySummary, dueLine } from "./daily-summary.policy"
import { EinvoiceReviewService } from "./einvoice-review.service"
import { FolioReconcileService } from "./folio-reconcile.service"
import { SUMMARY_COPY } from "./messages/accounting-desk.messages"
import { payablesDue, remindersToday, upcomingDues } from "./tax-calendar.policy"
import { suppliersOf, taxProfileOf } from "./tax-profile.policy"

const DAY_MS = 86_400_000
/** Vietnam is UTC+7 all year. */
const VN_OFFSET_MS = 7 * 3_600_000
/** How far ahead the card and the reminders look. */
const HORIZON_DAYS = 30
/** The module whose workspaces get the morning run. */
const ACCOUNTING_MODULE = "accounting"

/** The calendar day in Vietnam of an instant, `YYYY-MM-DD`. */
export const vnDayOf = (now: Date): string => new Date(now.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10)

@Injectable()
/**
 * N14 + N15 + N16 + N23, once a morning per workspace with the accounting agent: the tax profile and the suppliers come from the
 * Second Brain, the day's e-invoices and bank credits from the MCP gateway; the invoices are checked, the credits matched to
 * HAKUEN folios, and the `daily_summary` card and the due-date reminders go to the accounting room.
 */
export class DeskDailyService {
    constructor(
        private readonly facts: BrainFactsService,
        private readonly installations: InstallationRecordsService,
        @InjectAccountingGateway() private readonly gateway: AccountingGateway,
        private readonly review: EinvoiceReviewService,
        private readonly folios: FolioReconcileService,
        private readonly room: AccountingRoomService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Runs the morning for every workspace with the accounting module. */
    async runAll(): Promise<number> {
        const workspaces = await this.installations.workspacesOf(ACCOUNTING_MODULE)
        await eachInOrder(workspaces, (workspaceId) => this.run(workspaceId))
        return workspaces.length
    }

    /** Checks the day's invoices and credits, then posts the card and the reminders due today. */
    async run(workspaceId: string): Promise<DailyOutcome> {
        const facts = await this.facts.list(workspaceId, { statuses: ["active"] })
        const profile = taxProfileOf(facts)
        if (profile === null) return { card: null, reminders: 0 }
        const suppliers = suppliersOf(facts)
        const now = this.clock.now()
        const day = vnDayOf(now)
        const since = new Date(now.getTime() - DAY_MS)
        const tally = await this.review.review(workspaceId, profile, suppliers, since)
        const credits = await this.gateway.listBankCredits(workspaceId, since.toISOString())
        let recorded = 0
        await eachInOrder(
            credits.filter((credit) => !credit.matched),
            async (credit) => {
                const outcome = await this.folios.reconcile(workspaceId, credit)
                if (outcome.kind === "recorded") recorded += 1
            },
        )
        const payables = payablesDue(
            await this.gateway.listOpenPayables(workspaceId),
            suppliers,
            profile.supplierTermDays,
        )
        const upcoming = upcomingDues(profile, payables, day, HORIZON_DAYS)
        const card = buildDailySummary({ day, ...tally, ...bankCounts(credits, recorded), upcoming })
        await this.room.postCard(workspaceId, card.hub, card.text)
        const due = remindersToday(upcoming, profile.reminderDays)
        await eachInOrder(due, (item) => this.room.post(workspaceId, SUMMARY_COPY.reminder(dueLine(item), item.note)))
        return { card, reminders: due.length }
    }
}
