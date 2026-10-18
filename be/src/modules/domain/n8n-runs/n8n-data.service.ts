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
import { InjectAccountDirectory } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import {
    SELECT_DAY_NUMBERS,
    SELECT_LEAD_CONTACTS,
    SELECT_LEDGER_INVOICES,
    SELECT_LEDGER_TRANSACTIONS,
    SELECT_OVERDUE_INVOICES,
    SELECT_OWNER_MEMBERS,
    SELECT_RECEIPT_INVOICE,
    SELECT_RECEIPT_TRANSACTION,
    SELECT_REMINDED_INVOICES,
    SELECT_SHOP_NAME,
} from "./persistence/n8n-data.sql"
import type {
    DayNumbersRow,
    LeadContactRow,
    LedgerInvoiceRow,
    LedgerTransactionRow,
    OverdueInvoiceRow,
    ReceiptInvoiceRow,
    ReceiptTransactionRow,
} from "./persistence/n8n-runs.rows"
import { csvOf, dayOf, dayRange, daysLate, dmy, periodOf, periodRange, vnd, vnDay } from "./policies/n8n-data.policy"

const DEFAULT_SHOP = "NIVO"
const DEFAULT_DEBT_AFTER_DAYS = 3
const DEFAULT_DEBT_REPEAT_DAYS = 7
const DAY_MS = 86_400_000
const REMINDERS_MAX = 50

@Injectable()
/** The data the shared n8n workflows fetch (the day's figures, overdue invoices, a month of the ledger) and the owners they mail. */
export class N8nDataService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        @InjectAccountDirectory() private readonly accounts: AccountDirectory,
    ) {}

    /** The name of the shop. */
    async shopName(workspaceId: string): Promise<string> {
        const [row] = await this.entityManager.query<Array<{ name: string }>>(SELECT_SHOP_NAME, [workspaceId])
        return row?.name ?? DEFAULT_SHOP
    }

    /** The owners and managers of the workspace with an address: the only addresses an owner-facing mail may go to, besides the accountant. */
    async ownerRecipients(workspaceId: string): Promise<ReadonlyArray<OwnerRecipient>> {
        const members = await this.entityManager.query<Array<{ user_id: string; display_name: string }>>(
            SELECT_OWNER_MEMBERS,
            [workspaceId],
        )
        const found = await Promise.all(
            members.map(async (member) => {
                const account = await this.accounts.accountOf(member.user_id)
                return account.kind === "ok" && account.value.email
                    ? [{ email: account.value.email.toLowerCase(), name: member.display_name }]
                    : []
            }),
        )
        return found.flat()
    }

    /** The figures of one day (today when none is named) and the owners to mail. */
    async dailySummary(workspaceId: string, requestedDay: OptionalText): Promise<DaySummary> {
        const now = this.clock.now()
        const day = dayOf(requestedDay, now)
        const { from, to } = dayRange(day)
        const [row] = await this.entityManager.query<Array<DayNumbersRow>>(SELECT_DAY_NUMBERS, [
            workspaceId,
            from,
            to,
            now.toISOString(),
        ])
        const numbers = {
            new_leads: row?.new_leads ?? 0,
            orders_confirmed: row?.orders_confirmed ?? 0,
            money_in: Number(row?.money_in ?? 0),
            money_in_count: row?.money_in_count ?? 0,
            invoiced: Number(row?.invoiced ?? 0),
            invoices_issued: row?.invoices_issued ?? 0,
            waiting_decisions: row?.waiting_decisions ?? 0,
            overdue_count: row?.overdue_count ?? 0,
            overdue_total: Number(row?.overdue_total ?? 0),
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
        const [shop, owners] = await Promise.all([this.shopName(workspaceId), this.ownerRecipients(workspaceId)])
        return {
            date: day,
            shop_name: shop,
            owners,
            numbers,
            variables: {
                ten_shop: shop,
                ngay: dmy(`${day}T12:00:00+07:00`),
                tom_tat: lines.join("\n"),
                viec_cho:
                    numbers.waiting_decisions > 0
                        ? this.say("waiting", { count: numbers.waiting_decisions })
                        : this.say("waitingNone"),
            },
        }
    }

    /** The overdue invoices of customers with an address that a reminder was not sent for lately, one item per reminder. */
    async overdueInvoices(workspaceId: string, config: N8nPipelineConfig): Promise<OverdueInvoices> {
        const now = this.clock.now()
        const afterDays = Math.max(0, Number(config.after_days ?? DEFAULT_DEBT_AFTER_DAYS))
        const repeatDays = Math.max(1, Number(config.repeat_days ?? DEFAULT_DEBT_REPEAT_DAYS))
        const invoices = await this.entityManager.query<Array<OverdueInvoiceRow>>(SELECT_OVERDUE_INVOICES, [
            workspaceId,
            new Date(now.getTime() - afterDays * DAY_MS).toISOString(),
        ])
        const leadIds = [...new Set(invoices.flatMap((invoice) => (invoice.lead_id === null ? [] : [invoice.lead_id])))]
        const [leads, reminded, shop] = await Promise.all([
            leadIds.length > 0
                ? this.entityManager.query<Array<LeadContactRow>>(SELECT_LEAD_CONTACTS, [leadIds])
                : Promise.resolve<Array<LeadContactRow>>([]),
            this.entityManager.query<Array<{ invoice_id: string | null }>>(SELECT_REMINDED_INVOICES, [
                workspaceId,
                new Date(now.getTime() - repeatDays * DAY_MS).toISOString(),
            ]),
            this.shopName(workspaceId),
        ])
        const contactOf = new Map(leads.map((lead) => [lead.id, lead]))
        const remindedIds = new Set(reminded.map((row) => row.invoice_id))
        const today = vnDay(now)
        let noEmail = 0
        let recent = 0
        const items = invoices.flatMap((invoice) => {
            const lead = invoice.lead_id === null ? undefined : contactOf.get(invoice.lead_id)
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
                    refs: { invoice_id: invoice.id, lead_id: lead.id, invoice_no: invoice.invoice_no },
                    variables: {
                        ten_khach: lead.contact_name,
                        ten_shop: shop,
                        so_tien: vnd(Number(invoice.amount_vnd)),
                        ma_phieu: invoice.invoice_no,
                        han: dmy(invoice.due_at ?? now),
                        so_ngay_tre: daysLate(invoice.due_at ?? now, now),
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
            this.entityManager.query<Array<LedgerTransactionRow>>(SELECT_LEDGER_TRANSACTIONS, [workspaceId, from, to]),
            this.entityManager.query<Array<LedgerInvoiceRow>>(SELECT_LEDGER_INVOICES, [workspaceId, from, to]),
            this.shopName(workspaceId),
        ])
        const rows: Array<Array<string | number | null>> = [
            this.say("csvHeader").split(","),
            ...payments.map((payment) => [
                dmy(payment.occurred_at),
                this.say("csvMoney"),
                payment.amount_vnd,
                payment.reference,
                payment.payer,
                payment.channel,
                payment.status,
            ]),
            ...invoices.map((invoice) => [
                dmy(invoice.issued_at ?? from),
                this.say("csvInvoice"),
                invoice.amount_vnd,
                invoice.invoice_no,
                "",
                "",
                invoice.status,
            ]),
        ]
        const totalIn = payments.reduce((sum, payment) => sum + Number(payment.amount_vnd), 0)
        const totalInvoiced = invoices.reduce((sum, invoice) => sum + Number(invoice.amount_vnd), 0)
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
        const [payment] = transactionId
            ? await this.entityManager.query<Array<ReceiptTransactionRow>>(SELECT_RECEIPT_TRANSACTION, [
                  workspaceId,
                  transactionId,
              ])
            : []
        const resolvedInvoice = invoiceId || payment?.invoice_id || ""
        if (!resolvedInvoice) return null
        const [invoice] = await this.entityManager.query<Array<ReceiptInvoiceRow>>(SELECT_RECEIPT_INVOICE, [
            workspaceId,
            resolvedInvoice,
        ])
        if (invoice?.lead_id === undefined || invoice.lead_id === null) return null
        const [lead] = await this.entityManager.query<Array<LeadContactRow>>(SELECT_LEAD_CONTACTS, [[invoice.lead_id]])
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
                    ten_khach: lead.contact_name,
                    ten_shop: shop,
                    so_tien: vnd(Number(payment?.amount_vnd ?? invoice.amount_vnd)),
                    ma_phieu: invoice.invoice_no,
                    ngay: dmy(payment?.occurred_at ?? invoice.paid_at ?? this.clock.now()),
                },
            },
        }
    }

    private say(key: string, params: TextParams = {}): string {
        return this.catalog.get(`automations.n8nData.${key}`, params, "vi")
    }
}
