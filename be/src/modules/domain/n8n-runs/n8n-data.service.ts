import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import type {
    DaySummary,
    MonthLedger,
    OverdueInvoices,
    OwnerRecipient,
    ReceiptRunOrNone,
    TextParams,
    N8nPipelineConfig,
    OptionalText,
} from "./n8n-runs.contracts"
import { DeskDailyService, renewalSectionOf } from "@modules/domain/accounting"
import { EmailMessagesLedgerService } from "@modules/domain/email-messages"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersFiguresService } from "@modules/domain/orders"
import { TransactionsLedgerService } from "@modules/domain/transactions"
import { InjectAccountDirectory, MemberLookupService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { WorkItemsReadService } from "@modules/domain/work-items"
import { WorkspacesService } from "@modules/domain/workspaces"
import { csvOf, dayOf, dayRange, daysLate, dmy, periodOf, periodRange, vnd, vnDay } from "./policies/n8n-data.policy"
import type { InstantRange } from "./policies/n8n-data.policy"

/** The figures of a count-and-sum read. */
interface Tally {
    /** How many rows. */
    readonly total: number
    /** The sum of the amounts. */
    readonly amount: number
}

const DEFAULT_SHOP = "NIVO"
const DEFAULT_DEBT_AFTER_DAYS = 3
const DEFAULT_DEBT_REPEAT_DAYS = 7
const DAY_MS = 86_400_000
const REMINDERS_MAX = 50
const OWNERS_LIMIT = 50
const OVERDUE_LIMIT = 200
const REMINDED_LIMIT = 500
const LEDGER_LIMIT = 5000

@Injectable()
/** The data the shared n8n workflows fetch (the day's figures, overdue invoices, a month of the ledger) and the owners they mail. */
export class N8nDataService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        private readonly desk: DeskDailyService,
        private readonly workspaces: WorkspacesService,
        private readonly members: MemberLookupService,
        private readonly leads: LeadReadService,
        private readonly orders: OrdersFiguresService,
        private readonly invoices: InvoicesLedgerService,
        private readonly transactions: TransactionsLedgerService,
        private readonly workItems: WorkItemsReadService,
        private readonly emails: EmailMessagesLedgerService,
    ) {}

    /** The name of the shop. */
    async shopName(workspaceId: string): Promise<string> {
        const name = await this.workspaces.nameOf(workspaceId)
        return name === "" ? DEFAULT_SHOP : name
    }

    /** The owners and managers of the workspace with an address: the only addresses an owner-facing mail may go to, besides the accountant. */
    async ownerRecipients(workspaceId: string): Promise<ReadonlyArray<OwnerRecipient>> {
        const members = await this.members.ownersAndManagers(workspaceId, OWNERS_LIMIT)
        const found = await Promise.all(
            members.map(async (member) => {
                const account = await this.accounts.accountOf(member.userId)
                return account.kind === "ok" && account.value.email
                    ? [{ email: account.value.email.toLowerCase(), name: member.displayName }]
                    : []
            }),
        )
        return found.flat()
    }

    /** The figures of one day (today when none is named) and the owners to mail. */
    async dailySummary(workspaceId: string, requestedDay: OptionalText): Promise<DaySummary> {
        const now = this.clock.now()
        const day = dayOf(requestedDay, now)
        const window = dayRange(day)
        const [leads, orders, credits, invoiced, waiting, overdue] = await this.tallies(workspaceId, window, now)
        const numbers = {
            new_leads: leads.total,
            orders_confirmed: orders.total,
            money_in: Number(credits.amount),
            money_in_count: credits.total,
            invoiced: Number(invoiced.amount),
            invoices_issued: invoiced.total,
            waiting_decisions: waiting.total,
            overdue_count: overdue.total,
            overdue_total: Number(overdue.amount),
        }
        const lines = [
            this.say("newLeads", { count: numbers.new_leads }),
            this.say("ordersConfirmed", { count: numbers.orders_confirmed }),
            this.say("moneyIn", { amount: vnd(numbers.money_in), count: numbers.money_in_count }),
            this.say("invoices", { count: numbers.invoices_issued, amount: vnd(numbers.invoiced) }),
            numbers.overdue_count > 0
                ? this.say("overdueAmount", { count: numbers.overdue_count, amount: vnd(numbers.overdue_total) })
                : this.say("overdue", { count: numbers.overdue_count }),
        ]
        const [shop, owners, renewal] = await Promise.all([
            this.shopName(workspaceId),
            this.ownerRecipients(workspaceId),
            this.desk.renewalOfDay(workspaceId, day),
        ])
        return {
            date: day,
            shop_name: shop,
            owners,
            numbers,
            variables: {
                ten_shop: shop,
                ngay: dmy(`${day}T12:00:00+07:00`),
                tom_tat: [...lines, renewalSectionOf(renewal)].join("\n"),
                viec_cho:
                    numbers.waiting_decisions > 0
                        ? this.say("waiting", { count: numbers.waiting_decisions })
                        : this.say("waitingNone"),
            },
        }
    }

    /** The six day counters, in order: new leads, confirmed orders, money in, invoiced, waiting decisions and overdue. */
    private async tallies(
        workspaceId: string,
        window: InstantRange,
        now: Date,
    ): Promise<[Tally, Tally, Tally, Tally, Tally, Tally]> {
        const from = new Date(window.from)
        const to = new Date(window.to)
        const [leads, orders, credits, invoiced, waiting, overdue] = await Promise.all([
            this.leads.countCreatedBetween(workspaceId, from, to),
            this.orders.countConfirmedBetween(workspaceId, from, to),
            this.transactions.creditTally(workspaceId, from, to),
            this.invoices.issuedTally(workspaceId, from, to),
            this.workItems.countByStatus(workspaceId, "waiting_decision"),
            this.invoices.overdueTally(workspaceId, now),
        ])
        return [
            { total: leads, amount: 0 },
            { total: orders, amount: 0 },
            credits,
            invoiced,
            { total: waiting, amount: 0 },
            overdue,
        ]
    }

    /** The overdue invoices of customers with an address that a reminder was not sent for lately, one item per reminder. */
    async overdueInvoices(workspaceId: string, config: N8nPipelineConfig): Promise<OverdueInvoices> {
        const now = this.clock.now()
        const afterDays = Math.max(0, Number(config.after_days ?? DEFAULT_DEBT_AFTER_DAYS))
        const repeatDays = Math.max(1, Number(config.repeat_days ?? DEFAULT_DEBT_REPEAT_DAYS))
        const invoices = await this.invoices.overdueBefore(
            workspaceId,
            new Date(now.getTime() - afterDays * DAY_MS),
            OVERDUE_LIMIT,
        )
        const leadIds = [...new Set(invoices.flatMap((invoice) => (invoice.leadId === null ? [] : [invoice.leadId])))]
        const [leads, reminded, shop] = await Promise.all([
            leadIds.length > 0 ? this.leads.cardsOf(workspaceId, leadIds) : Promise.resolve([]),
            this.emails.remindedInvoiceIds(workspaceId, new Date(now.getTime() - repeatDays * DAY_MS), REMINDED_LIMIT),
            this.shopName(workspaceId),
        ])
        const contactOf = new Map(leads.map((lead) => [lead.id, lead]))
        const remindedIds = new Set(reminded)
        const today = vnDay(now)
        let noEmail = 0
        let recent = 0
        const items = invoices.flatMap((invoice) => {
            const lead = invoice.leadId === null ? undefined : contactOf.get(invoice.leadId)
            if (!lead?.email) {
                noEmail += 1
                return []
            }
            if (remindedIds.has(invoice.id)) {
                recent += 1
                return []
            }
            return [
                {
                    to: lead.email.toLowerCase(),
                    dedupe: `debt:${invoice.id}:${today}`,
                    refs: { invoice_id: invoice.id, lead_id: lead.id, invoice_no: invoice.invoiceNo },
                    variables: {
                        ten_khach: lead.contactName,
                        ten_shop: shop,
                        so_tien: vnd(Number(invoice.amountVnd)),
                        ma_phieu: invoice.invoiceNo,
                        han: dmy(invoice.dueAt ?? now),
                        so_ngay_tre: daysLate(invoice.dueAt ?? now, now),
                    },
                },
            ]
        })
        return {
            shop_name: shop,
            items: items.slice(0, REMINDERS_MAX),
            skipped: { no_email: noEmail, reminded_recently: recent },
        }
    }

    /** A month of the ledger (last month when none is named): money in and invoices issued, as CSV and as the variables of the email. */
    async monthLedger(workspaceId: string, requestedPeriod: OptionalText): Promise<MonthLedger> {
        const period = periodOf(requestedPeriod, this.clock.now())
        const { from, to, label } = periodRange(period)
        const [payments, invoices, shop] = await Promise.all([
            this.transactions.creditLedger(workspaceId, new Date(from), new Date(to), LEDGER_LIMIT),
            this.invoices.issuedLedger(workspaceId, new Date(from), new Date(to), LEDGER_LIMIT),
            this.shopName(workspaceId),
        ])
        const rows: Array<Array<string | number | null>> = [
            this.say("csvHeader").split(","),
            ...payments.map((payment) => [
                dmy(payment.occurredAt),
                this.say("csvMoney"),
                payment.amountVnd,
                payment.reference,
                payment.payer,
                payment.channel,
                payment.status,
            ]),
            ...invoices.map((invoice) => [
                dmy(invoice.issuedAt ?? from),
                this.say("csvInvoice"),
                invoice.amountVnd,
                invoice.invoiceNo,
                "",
                "",
                invoice.status,
            ]),
        ]
        const totalIn = payments.reduce((sum, payment) => sum + Number(payment.amountVnd), 0)
        const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.amountVnd), 0)
        return {
            csv: csvOf(rows),
            period,
            filename: `${this.say("csvFile")}-${period}.csv`,
            rows: rows.length - 1,
            variables: {
                ten_shop: shop,
                ky: label,
                tom_tat: [
                    this.say("ledgerMoney", { amount: vnd(totalIn), count: payments.length }),
                    this.say("ledgerInvoices", { amount: vnd(totalInvoiced), count: invoices.length }),
                ].join("\n"),
            },
        }
    }

    /**
     * The receipt of a payment that was matched to an invoice whose customer has an address: what the receipt workflow runs with, one
     * receipt per payment. Null when the payment is not matched or the customer has no address.
     */
    async paymentReceipt(workspaceId: string, transactionId: string, invoiceId: string): Promise<ReceiptRunOrNone> {
        if (!transactionId && !invoiceId) return null
        const payment = transactionId ? await this.transactions.receiptPayment(workspaceId, transactionId) : null
        const resolvedInvoice = invoiceId || payment?.invoiceId || ""
        if (!resolvedInvoice) return null
        const invoice = await this.invoices.receiptInvoice(workspaceId, resolvedInvoice)
        if (invoice?.leadId === undefined || invoice.leadId === null) return null
        const [lead] = await this.leads.cardsOf(workspaceId, [invoice.leadId])
        if (!lead?.email) return null
        const shop = await this.shopName(workspaceId)
        const key = `receipt:${transactionId || resolvedInvoice}`
        return {
            dedupe: key,
            data: {
                to: lead.email.toLowerCase(),
                dedupe: key,
                refs: { invoice_id: resolvedInvoice, lead_id: lead.id, transaction_id: transactionId || null },
                variables: {
                    ten_khach: lead.contactName,
                    ten_shop: shop,
                    so_tien: vnd(Number(payment?.amountVnd ?? invoice.amountVnd)),
                    ma_phieu: invoice.invoiceNo,
                    ngay: dmy(payment?.occurredAt ?? invoice.paidAt ?? this.clock.now()),
                },
            },
        }
    }

    private say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.n8nData.${key}`, params, "vi")
    }
}
