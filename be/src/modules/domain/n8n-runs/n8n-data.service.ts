import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
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
import { InjectAccountDirectory } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { csvOf, dayOf, dayRange, daysLate, dmy, periodOf, periodRange, vnd, vnDay } from "./policies/n8n-data.policy"
import type { InstantRange } from "./policies/n8n-data.policy"

/** The figures of a count-and-sum query; a bigint sum arrives as text. */
interface Tally {
    /** How many rows. */
    readonly total: number
    /** The sum of the amounts (a bigint the driver answers as text). */
    readonly amount: string | number
}

/** An overdue invoice. */
interface OverdueInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** When it was due. */
    readonly dueAt: Date | null
    /** The customer. */
    readonly leadId: string | null
}

/** A lead's name and address. */
interface LeadContact {
    /** The lead id. */
    readonly id: string
    /** The name. */
    readonly contactName: string
    /** The address. */
    readonly email: string | null
}

/** A payment of the ledger. */
interface LedgerPayment {
    /** When the money arrived. */
    readonly occurredAt: Date
    /** The amount in VND. */
    readonly amountVnd: number
    /** The bank reference. */
    readonly reference: string | null
    /** The payer. */
    readonly payer: string | null
    /** The channel. */
    readonly channel: string
    /** The state. */
    readonly status: string
}

/** An invoice of the ledger. */
interface LedgerInvoice {
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** When it was issued. */
    readonly issuedAt: Date | null
    /** The state. */
    readonly status: string
}

/** The invoice a receipt is for. */
interface ReceiptInvoice {
    /** The invoice id. */
    readonly id: string
    /** The invoice number. */
    readonly invoiceNo: string
    /** The amount in VND. */
    readonly amountVnd: number
    /** The customer. */
    readonly leadId: string | null
    /** When it was paid. */
    readonly paidAt: Date | null
}

/** The payment a receipt is for. */
interface ReceiptPayment {
    /** The invoice it settles. */
    readonly invoiceId: string | null
    /** The amount in VND. */
    readonly amountVnd: number
    /** When the money arrived. */
    readonly occurredAt: Date
}

const DEFAULT_SHOP = "NIVO"
const DEFAULT_DEBT_AFTER_DAYS = 3
const DEFAULT_DEBT_REPEAT_DAYS = 7
const DAY_MS = 86_400_000
const REMINDERS_MAX = 50
const OWNERS_LIMIT = 50
const OVERDUE_LIMIT = 200
const LEAD_CONTACTS_LIMIT = 200
const REMINDED_LIMIT = 500
const LEDGER_LIMIT = 5000

@Injectable()
/** The data the shared n8n workflows fetch (the day's figures, overdue invoices, a month of the ledger) and the owners they mail. */
export class N8nDataService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
        private readonly desk: DeskDailyService,
    ) {}

    /** The name of the shop. */
    async shopName(workspaceId: string): Promise<string> {
        const row = await this.entityManager
            .createQueryBuilder()
            .select("w.name", "name")
            .from("public.workspaces", "w")
            .where("w.id = :workspaceId", { workspaceId })
            .limit(1)
            .getRawOne<{ name: string }>()
        return row?.name ?? DEFAULT_SHOP
    }

    /** The owners and managers of the workspace with an address: the only addresses an owner-facing mail may go to, besides the accountant. */
    async ownerRecipients(workspaceId: string): Promise<ReadonlyArray<OwnerRecipient>> {
        const members = await this.entityManager
            .createQueryBuilder()
            .select("m.user_id", "userId")
            .addSelect("m.display_name", "displayName")
            .from("public.workspace_members", "m")
            .where("m.workspace_id = :workspaceId AND m.status = 'active' AND m.role IN ('owner', 'manager')", {
                workspaceId,
            })
            .limit(OWNERS_LIMIT)
            .getRawMany<{ userId: string; displayName: string }>()
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
    private tallies(
        workspaceId: string,
        window: InstantRange,
        now: Date,
    ): Promise<[Tally, Tally, Tally, Tally, Tally, Tally]> {
        const { from, to } = window
        return Promise.all([
            this.tally(
                "public.leads",
                "l",
                "l.workspace_id = :workspaceId AND l.created_at >= :from AND l.created_at < :to",
                {
                    workspaceId,
                    from,
                    to,
                },
            ),
            this.tally(
                "public.orders",
                "o",
                "o.workspace_id = :workspaceId AND o.confirmed_at >= :from AND o.confirmed_at < :to",
                { workspaceId, from, to },
            ),
            this.tally(
                "public.transactions",
                "t",
                "t.workspace_id = :workspaceId AND t.direction = 'credit' AND t.occurred_at >= :from AND t.occurred_at < :to",
                { workspaceId, from, to },
                "coalesce(sum(t.amount_vnd), 0)::bigint",
            ),
            this.tally(
                "public.invoices",
                "i",
                "i.workspace_id = :workspaceId AND i.status = 'issued' AND i.issued_at >= :from AND i.issued_at < :to",
                { workspaceId, from, to },
                "coalesce(sum(i.amount_vnd), 0)::bigint",
            ),
            this.tally("public.work_items", "w", "w.workspace_id = :workspaceId AND w.status = 'waiting_decision'", {
                workspaceId,
            }),
            this.tally(
                "public.invoices",
                "d",
                "d.workspace_id = :workspaceId AND d.status = 'issued' AND d.due_at < :now",
                { workspaceId, now: now.toISOString() },
                "coalesce(sum(d.amount_vnd), 0)::bigint",
            ),
        ])
    }

    /** The overdue invoices of customers with an address that a reminder was not sent for lately, one item per reminder. */
    async overdueInvoices(workspaceId: string, config: N8nPipelineConfig): Promise<OverdueInvoices> {
        const now = this.clock.now()
        const afterDays = Math.max(0, Number(config.after_days ?? DEFAULT_DEBT_AFTER_DAYS))
        const repeatDays = Math.max(1, Number(config.repeat_days ?? DEFAULT_DEBT_REPEAT_DAYS))
        const invoices = await this.entityManager
            .createQueryBuilder()
            .select("i.id", "id")
            .addSelect("i.invoice_no", "invoiceNo")
            .addSelect("i.amount_vnd", "amountVnd")
            .addSelect("i.due_at", "dueAt")
            .addSelect("i.lead_id", "leadId")
            .from("public.invoices", "i")
            .where("i.workspace_id = :workspaceId AND i.status = 'issued' AND i.due_at < :cutoff", {
                workspaceId,
                cutoff: new Date(now.getTime() - afterDays * DAY_MS).toISOString(),
            })
            .orderBy("i.due_at")
            .limit(OVERDUE_LIMIT)
            .getRawMany<OverdueInvoice>()
        const leadIds = [...new Set(invoices.flatMap((invoice) => (invoice.leadId === null ? [] : [invoice.leadId])))]
        const [leads, reminded, shop] = await Promise.all([
            leadIds.length > 0 ? this.leadContacts(leadIds) : Promise.resolve<Array<LeadContact>>([]),
            this.entityManager
                .createQueryBuilder()
                .select("e.refs ->> 'invoice_id'", "invoiceId")
                .distinct(true)
                .from("public.email_messages", "e")
                .where(
                    "e.workspace_id = :workspaceId AND e.purpose = 'debt_reminder' AND e.status IN ('sent', 'waiting_decision') AND e.created_at >= :since",
                    { workspaceId, since: new Date(now.getTime() - repeatDays * DAY_MS).toISOString() },
                )
                .limit(REMINDED_LIMIT)
                .getRawMany<{ invoiceId: string | null }>(),
            this.shopName(workspaceId),
        ])
        const contactOf = new Map(leads.map((lead) => [lead.id, lead]))
        const remindedIds = new Set(reminded.map((row) => row.invoiceId))
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
            this.entityManager
                .createQueryBuilder()
                .select("t.occurred_at", "occurredAt")
                .addSelect("t.amount_vnd", "amountVnd")
                .addSelect("t.reference", "reference")
                .addSelect("t.payer", "payer")
                .addSelect("t.channel", "channel")
                .addSelect("t.status", "status")
                .from("public.transactions", "t")
                .where(
                    "t.workspace_id = :workspaceId AND t.direction = 'credit' AND t.occurred_at >= :from AND t.occurred_at < :to",
                    { workspaceId, from, to },
                )
                .orderBy("t.occurred_at")
                .limit(LEDGER_LIMIT)
                .getRawMany<LedgerPayment>(),
            this.entityManager
                .createQueryBuilder()
                .select("i.invoice_no", "invoiceNo")
                .addSelect("i.amount_vnd", "amountVnd")
                .addSelect("i.issued_at", "issuedAt")
                .addSelect("i.status", "status")
                .from("public.invoices", "i")
                .where(
                    "i.workspace_id = :workspaceId AND i.status <> 'draft' AND i.issued_at >= :from AND i.issued_at < :to",
                    { workspaceId, from, to },
                )
                .orderBy("i.issued_at")
                .limit(LEDGER_LIMIT)
                .getRawMany<LedgerInvoice>(),
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
        const payment = transactionId
            ? await this.entityManager
                  .createQueryBuilder()
                  .select("t.invoice_id", "invoiceId")
                  .addSelect("t.amount_vnd", "amountVnd")
                  .addSelect("t.occurred_at", "occurredAt")
                  .from("public.transactions", "t")
                  .where("t.workspace_id = :workspaceId AND t.id = :transactionId", { workspaceId, transactionId })
                  .limit(1)
                  .getRawOne<ReceiptPayment>()
            : undefined
        const resolvedInvoice = invoiceId || payment?.invoiceId || ""
        if (!resolvedInvoice) return null
        const invoice = await this.entityManager
            .createQueryBuilder()
            .select("i.id", "id")
            .addSelect("i.invoice_no", "invoiceNo")
            .addSelect("i.amount_vnd", "amountVnd")
            .addSelect("i.lead_id", "leadId")
            .addSelect("i.paid_at", "paidAt")
            .from("public.invoices", "i")
            .where("i.workspace_id = :workspaceId AND i.id = :invoiceId", { workspaceId, invoiceId: resolvedInvoice })
            .limit(1)
            .getRawOne<ReceiptInvoice>()
        if (invoice?.leadId === undefined || invoice.leadId === null) return null
        const [lead] = await this.leadContacts([invoice.leadId])
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

    private leadContacts(ids: ReadonlyArray<string>): Promise<Array<LeadContact>> {
        return this.entityManager
            .createQueryBuilder()
            .select("l.id", "id")
            .addSelect("l.contact_name", "contactName")
            .addSelect("l.email", "email")
            .from("public.leads", "l")
            .where("l.id IN (:...ids)", { ids })
            .limit(LEAD_CONTACTS_LIMIT)
            .getRawMany<LeadContact>()
    }

    /** The count, and optionally the sum of an amount column, of the rows of a table that match a condition. */
    private async tally(
        table: string,
        alias: string,
        condition: string,
        parameters: Record<string, string>,
        amount = "0",
    ): Promise<Tally> {
        const row = await this.entityManager
            .createQueryBuilder()
            .select("count(*)::int", "total")
            .addSelect(amount, "amount")
            .from(table, alias)
            .where(condition, parameters)
            .getRawOne<Tally>()
        return row ?? { total: 0, amount: 0 }
    }

    private say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.n8nData.${key}`, params, "vi")
    }
}
