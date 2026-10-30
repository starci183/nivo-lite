import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { DeskDailyService, renewalSectionOf } from "@modules/domain/accounting"
import type { RenewalCashReport } from "@modules/domain/accounting"
import { EmailMessagesLedgerService } from "@modules/domain/email-messages"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import type { OverdueInvoice, ReceiptInvoice } from "@modules/domain/invoices"
import { LeadReadService } from "@modules/domain/leads"
import { OrdersFiguresService } from "@modules/domain/orders"
import { TransactionsLedgerService } from "@modules/domain/transactions"
import { WorkItemsReadService } from "@modules/domain/work-items"
import { ACCOUNT_DIRECTORY, MemberLookupService } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { WorkspacesService } from "@modules/domain/workspaces"
import { CLOCK } from "@modules/platform/clock"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { ok, refused } from "@modules/platform/primitives"
import { N8nDataService } from "./n8n-data.service"

/** A pattern matcher, typed `unknown` so it flows into any slot. */
const stringMatch = (pattern: RegExp | string): unknown => expect.stringMatching(pattern)

/** A by-constructor matcher, typed `unknown` so it flows into any slot. */
const anyOf = (type: unknown): unknown => expect.any(type)

const NOW = "2026-10-12T10:00:00.000Z"
const RENEWAL_REPORT = mock<RenewalCashReport>({ lines: ["   - Renewal line"] })

/** Builds the data service over fresh owner doubles; the doubles come back so a test can arrange and check them. */
const build = async () => {
    const catalog = mock<MessageCatalog>()
    catalog.get.mockImplementation(
        (key, params) => `${key.replace("automations.n8nData.", "")}${JSON.stringify(params ?? {})}`,
    )
    const accounts = mock<AccountDirectory>()
    accounts.accountOf.mockImplementation((id) =>
        Promise.resolve(
            id === "u-1"
                ? ok({ email: "Owner@Shop.VN", lastSignInAt: null, displayName: "Lan" })
                : id === "u-2"
                  ? ok({ email: "", lastSignInAt: null, displayName: "" })
                  : refused("ACCOUNT_NOT_FOUND"),
        ),
    )
    const desk = mock<DeskDailyService>()
    desk.renewalOfDay.mockResolvedValue(RENEWAL_REPORT)
    const workspaces = mock<WorkspacesService>()
    const members = mock<MemberLookupService>()
    const leads = mock<LeadReadService>()
    const orders = mock<OrdersFiguresService>()
    const invoices = mock<InvoicesLedgerService>()
    const transactions = mock<TransactionsLedgerService>()
    const workItems = mock<WorkItemsReadService>()
    const emails = mock<EmailMessagesLedgerService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nDataService,
            { provide: DeskDailyService, useValue: desk },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
            { provide: WorkspacesService, useValue: workspaces },
            { provide: MemberLookupService, useValue: members },
            { provide: LeadReadService, useValue: leads },
            { provide: OrdersFiguresService, useValue: orders },
            { provide: InvoicesLedgerService, useValue: invoices },
            { provide: TransactionsLedgerService, useValue: transactions },
            { provide: WorkItemsReadService, useValue: workItems },
            { provide: EmailMessagesLedgerService, useValue: emails },
        ],
    }).compile()
    return {
        service: moduleRef.get(N8nDataService),
        owners: { workspaces, members, leads, orders, invoices, transactions, workItems, emails },
    }
}

describe("N8nDataService shopName", () => {
    it("answers the name of the shop, or NIVO when it has none", async () => {
        const { owners, service } = await build()
        owners.workspaces.nameOf.mockResolvedValueOnce("Tiem Hoa").mockResolvedValueOnce("")

        await expect(service.shopName("ws-1")).resolves.toBe("Tiem Hoa")
        await expect(service.shopName("ws-1")).resolves.toBe("NIVO")
    })
})

describe("N8nDataService ownerRecipients", () => {
    it("answers the owners and managers who have an address, in lower case", async () => {
        const { owners, service } = await build()
        owners.members.ownersAndManagers.mockResolvedValue([
            { userId: "u-1", displayName: "Lan" },
            { userId: "u-2", displayName: "No address" },
            { userId: "u-3", displayName: "Unknown" },
        ])

        await expect(service.ownerRecipients("ws-1")).resolves.toEqual([{ email: "owner@shop.vn", name: "Lan" }])

        expect(owners.members.ownersAndManagers).toHaveBeenCalledWith("ws-1", 50)
    })
})

describe("N8nDataService dailySummary", () => {
    const answered = async () => {
        const built = await build()
        const { owners } = built
        owners.leads.countCreatedBetween.mockResolvedValue(2)
        owners.orders.countConfirmedBetween.mockResolvedValue(1)
        owners.transactions.creditTally.mockResolvedValue({ total: 1, amount: 500000 })
        owners.invoices.issuedTally.mockResolvedValue({ total: 2, amount: 700000 })
        owners.workItems.countByStatus.mockResolvedValue(3)
        owners.invoices.overdueTally.mockResolvedValue({ total: 1, amount: 200000 })
        owners.workspaces.nameOf.mockResolvedValue("Tiem Hoa")
        owners.members.ownersAndManagers.mockResolvedValue([])
        return built
    }

    it("reports the figures of the named day in words, with what waits and what is overdue", async () => {
        const { owners, service } = await answered()

        const summary = await service.dailySummary("ws-1", "2026-10-11")

        expect(summary).toMatchObject({
            date: "2026-10-11",
            shop_name: "Tiem Hoa",
            owners: [],
            numbers: { money_in: 500000, invoiced: 700000, overdue_total: 200000, waiting_decisions: 3 },
            variables: { ten_shop: "Tiem Hoa", ngay: "11/10/2026", viec_cho: 'waiting{"count":3}' },
        })
        expect(String(summary.variables.tom_tat).split("\n")).toEqual([
            'newLeads{"count":2}',
            'ordersConfirmed{"count":1}',
            stringMatch(/^moneyIn/),
            stringMatch(/^invoices/),
            stringMatch(/^overdueAmount/),
            ...renewalSectionOf(RENEWAL_REPORT).split("\n"),
        ])
        const from = new Date("2026-10-10T17:00:00.000Z")
        const to = new Date("2026-10-11T17:00:00.000Z")
        expect(owners.leads.countCreatedBetween).toHaveBeenCalledWith("ws-1", from, to)
        expect(owners.orders.countConfirmedBetween).toHaveBeenCalledWith("ws-1", from, to)
        expect(owners.transactions.creditTally).toHaveBeenCalledWith("ws-1", from, to)
        expect(owners.invoices.issuedTally).toHaveBeenCalledWith("ws-1", from, to)
        expect(owners.workItems.countByStatus).toHaveBeenCalledWith("ws-1", "waiting_decision")
        expect(owners.invoices.overdueTally).toHaveBeenCalledWith("ws-1", new Date(NOW))
    })

    it("reports an empty day: today, nothing overdue, nothing waiting", async () => {
        const { owners, service } = await build()
        owners.leads.countCreatedBetween.mockResolvedValue(0)
        owners.orders.countConfirmedBetween.mockResolvedValue(0)
        owners.transactions.creditTally.mockResolvedValue({ total: 0, amount: 0 })
        owners.invoices.issuedTally.mockResolvedValue({ total: 0, amount: 0 })
        owners.workItems.countByStatus.mockResolvedValue(0)
        owners.invoices.overdueTally.mockResolvedValue({ total: 0, amount: 0 })
        owners.workspaces.nameOf.mockResolvedValue("")
        owners.members.ownersAndManagers.mockResolvedValue([])

        const summary = await service.dailySummary("ws-1", null)

        expect(summary.date).toBe("2026-10-12")
        expect(summary.numbers).toMatchObject({ new_leads: 0, money_in: 0, overdue_count: 0 })
        expect(summary.variables.viec_cho).toBe("waitingNone{}")
        expect(summary.variables.tom_tat).toContain('overdue{"count":0}')
    })
})

const NO_DUE_INVOICE: OverdueInvoice = { id: "i-2", invoiceNo: "HD2", amountVnd: 200000, dueAt: null, leadId: "l-2" }
const NO_LEAD_INVOICE: OverdueInvoice = {
    id: "i-4",
    invoiceNo: "HD4",
    amountVnd: 400000,
    dueAt: new Date("2026-10-02T00:00:00Z"),
    leadId: null,
}
const OVERDUE_INVOICES: Array<OverdueInvoice> = [
    { id: "i-1", invoiceNo: "HD1", amountVnd: 100000, dueAt: new Date("2026-10-01T00:00:00Z"), leadId: "l-1" },
    NO_DUE_INVOICE,
    { id: "i-3", invoiceNo: "HD3", amountVnd: 300000, dueAt: new Date("2026-10-02T00:00:00Z"), leadId: "l-3" },
    NO_LEAD_INVOICE,
]

const card = (id: string, contactName: string, email: string | null) => ({
    id,
    contactName,
    company: "",
    channel: "",
    stage: "",
    email,
})

const OVERDUE_LEADS = [card("l-1", "An", "An@Mail.com"), card("l-2", "Binh", "binh@mail.com"), card("l-3", "Chi", null)]

describe("N8nDataService overdueInvoices", () => {
    it("lists reminders for addressed invoices not reminded lately and counts the others", async () => {
        const { owners, service } = await build()
        owners.invoices.overdueBefore.mockResolvedValue(OVERDUE_INVOICES)
        owners.leads.cardsOf.mockResolvedValue(OVERDUE_LEADS)
        owners.emails.remindedInvoiceIds.mockResolvedValue(["i-2"])
        owners.workspaces.nameOf.mockResolvedValue("Tiem Hoa")

        const result = await service.overdueInvoices("ws-1", { after_days: 5, repeat_days: 10 })

        expect(result.shop_name).toBe("Tiem Hoa")
        expect(result.skipped).toEqual({ no_email: 2, reminded_recently: 1 })
        expect(result.items).toHaveLength(1)
        expect(result.items[0]).toMatchObject({
            to: "an@mail.com",
            dedupe: "debt:i-1:2026-10-12",
            refs: { invoice_id: "i-1", lead_id: "l-1", invoice_no: "HD1" },
            variables: {
                ten_khach: "An",
                ten_shop: "Tiem Hoa",
                ma_phieu: "HD1",
                han: "01/10/2026",
                so_ngay_tre: 11,
            },
        })
        expect(owners.invoices.overdueBefore).toHaveBeenCalledWith("ws-1", new Date("2026-10-07T10:00:00.000Z"), 200)
        expect(owners.emails.remindedInvoiceIds).toHaveBeenCalledWith("ws-1", new Date("2026-10-02T10:00:00.000Z"), 500)
        expect(owners.leads.cardsOf).toHaveBeenCalledWith("ws-1", ["l-1", "l-2", "l-3"])
    })

    it("uses default delays, skips absent leads and treats missing due dates as due now", async () => {
        const { owners, service } = await build()
        owners.invoices.overdueBefore.mockResolvedValue([NO_LEAD_INVOICE])
        owners.emails.remindedInvoiceIds.mockResolvedValue([])
        owners.workspaces.nameOf.mockResolvedValue("")

        const result = await service.overdueInvoices("ws-1", {})

        expect(result).toEqual({ shop_name: "NIVO", items: [], skipped: { no_email: 1, reminded_recently: 0 } })
        expect(owners.invoices.overdueBefore).toHaveBeenCalledWith("ws-1", new Date("2026-10-09T10:00:00.000Z"), 200)
        expect(owners.leads.cardsOf).not.toHaveBeenCalled()
    })
})

describe("N8nDataService overdueInvoices limits", () => {
    it("dates an invoice with no due date today", async () => {
        const { owners, service } = await build()
        owners.invoices.overdueBefore.mockResolvedValue([NO_DUE_INVOICE])
        owners.leads.cardsOf.mockResolvedValue(OVERDUE_LEADS)
        owners.emails.remindedInvoiceIds.mockResolvedValue([])
        owners.workspaces.nameOf.mockResolvedValue("")

        const result = await service.overdueInvoices("ws-1", {})

        expect(result.items[0]?.variables).toMatchObject({ han: "12/10/2026", so_ngay_tre: 0 })
    })

    it("keeps at most fifty reminders", async () => {
        const many = Array.from({ length: 60 }, (_item, index) => ({
            id: `i-${index}`,
            invoiceNo: `HD${index}`,
            amountVnd: 1000,
            dueAt: new Date("2026-10-01T00:00:00Z"),
            leadId: "l-1",
        }))
        const { owners, service } = await build()
        owners.invoices.overdueBefore.mockResolvedValue(many)
        owners.leads.cardsOf.mockResolvedValue(OVERDUE_LEADS)
        owners.emails.remindedInvoiceIds.mockResolvedValue([])
        owners.workspaces.nameOf.mockResolvedValue("")

        await expect(service.overdueInvoices("ws-1", {})).resolves.toMatchObject({ items: anyOf(Array) })
        expect((await service.overdueInvoices("ws-1", {})).items).toHaveLength(50)
    })
})

describe("N8nDataService monthLedger", () => {
    it("writes a month of payments and invoices as csv, with the totals as variables", async () => {
        const { owners, service } = await build()
        owners.transactions.creditLedger.mockResolvedValue([
            {
                occurredAt: new Date("2026-09-05T03:00:00Z"),
                amountVnd: 100000,
                reference: "R1",
                payer: "An",
                channel: "bank",
                status: "ok",
            },
        ])
        owners.invoices.issuedLedger.mockResolvedValue([
            { invoiceNo: "HD1", amountVnd: 250000, issuedAt: new Date("2026-09-06T03:00:00Z"), status: "issued" },
            { invoiceNo: "HD2", amountVnd: 50000, issuedAt: null, status: "draft" },
        ])
        owners.workspaces.nameOf.mockResolvedValue("Tiem Hoa")

        const ledger = await service.monthLedger("ws-1", "2026-09")

        expect(ledger).toMatchObject({
            period: "2026-09",
            filename: "csvFile{}-2026-09.csv",
            rows: 3,
            variables: { ten_shop: "Tiem Hoa", ky: "09/2026" },
        })
        expect(ledger.csv).toContain("05/09/2026,csvMoney{},100000,R1,An,bank,ok")
        expect(ledger.csv).toContain("06/09/2026,csvInvoice{},250000,HD1,,,issued")
        expect(ledger.csv).toContain("01/09/2026,csvInvoice{},50000,HD2,,,draft")
        expect(ledger.variables.tom_tat).toContain('ledgerMoney{"amount":')
        const from = new Date("2026-08-31T17:00:00.000Z")
        const to = new Date("2026-09-30T17:00:00.000Z")
        expect(owners.transactions.creditLedger).toHaveBeenCalledWith("ws-1", from, to, 5000)
        expect(owners.invoices.issuedLedger).toHaveBeenCalledWith("ws-1", from, to, 5000)
    })

    it("reads last month when none is named", async () => {
        const { owners, service } = await build()
        owners.transactions.creditLedger.mockResolvedValue([])
        owners.invoices.issuedLedger.mockResolvedValue([])
        owners.workspaces.nameOf.mockResolvedValue("")

        await expect(service.monthLedger("ws-1", null)).resolves.toMatchObject({ period: "2026-09", rows: 0 })
    })
})

const invoice: ReceiptInvoice = {
    id: "i-1",
    invoiceNo: "HD1",
    amountVnd: 250000,
    leadId: "l-1",
    paidAt: new Date("2026-10-10T03:00:00Z"),
}
const lead = card("l-1", "An", "An@Mail.com")
const payment = { invoiceId: "i-1", amountVnd: 100000, occurredAt: new Date("2026-10-11T03:00:00Z") }

/** A data service whose owners know the given invoice and customers. */
const known = async (receiptInvoice: ReceiptInvoice | null, leads = [lead]) => {
    const built = await build()
    built.owners.invoices.receiptInvoice.mockResolvedValue(receiptInvoice)
    built.owners.leads.cardsOf.mockResolvedValue(leads)
    built.owners.workspaces.nameOf.mockResolvedValue("Tiem Hoa")
    return built
}

describe("N8nDataService paymentReceipt", () => {
    it("answers nothing without a payment or an invoice", async () => {
        const { owners, service } = await build()

        await expect(service.paymentReceipt("ws-1", "", "")).resolves.toBeNull()

        expect(owners.transactions.receiptPayment).not.toHaveBeenCalled()
        expect(owners.invoices.receiptInvoice).not.toHaveBeenCalled()
    })

    it("answers the receipt of a payment matched to an invoice, once per payment", async () => {
        const { owners, service } = await known(invoice)
        owners.transactions.receiptPayment.mockResolvedValue(payment)

        const receipt = await service.paymentReceipt("ws-1", "t-1", "")

        expect(receipt).toMatchObject({
            dedupe: "receipt:t-1",
            data: {
                to: "an@mail.com",
                dedupe: "receipt:t-1",
                refs: { invoice_id: "i-1", lead_id: "l-1", transaction_id: "t-1" },
                variables: { ten_khach: "An", ten_shop: "Tiem Hoa", ma_phieu: "HD1", ngay: "11/10/2026" },
            },
        })
    })

    it("answers the receipt of an invoice alone, with the invoice amount and its paid date", async () => {
        const { owners, service } = await known(invoice)

        const receipt = await service.paymentReceipt("ws-1", "", "i-1")

        expect(receipt).toMatchObject({
            dedupe: "receipt:i-1",
            data: { refs: { transaction_id: null }, variables: { ngay: "10/10/2026" } },
        })
        expect(owners.transactions.receiptPayment).not.toHaveBeenCalled()
    })

    it("dates the receipt today when neither the payment nor the invoice has a date", async () => {
        const { service } = await known({ ...invoice, paidAt: null })

        await expect(service.paymentReceipt("ws-1", "", "i-1")).resolves.toMatchObject({
            data: { variables: { ngay: "12/10/2026" } },
        })
    })
})

describe("N8nDataService paymentReceipt without a receipt", () => {
    it("answers nothing when the payment is not matched to an invoice", async () => {
        const matchless = await build()
        matchless.owners.transactions.receiptPayment.mockResolvedValue({ ...payment, invoiceId: null })
        const unknown = await build()
        unknown.owners.transactions.receiptPayment.mockResolvedValue(null)

        await expect(matchless.service.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
        await expect(unknown.service.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
    })

    it("answers nothing when the invoice is unknown or has no customer", async () => {
        const none = await known(null)
        const anonymous = await known({ ...invoice, leadId: null })

        await expect(none.service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        await expect(anonymous.service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
    })

    it("answers nothing when the customer has no address", async () => {
        const noAddress = await known(invoice, [{ ...lead, email: null }])
        const missing = await known(invoice, [])

        await expect(noAddress.service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        await expect(missing.service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
    })
})
