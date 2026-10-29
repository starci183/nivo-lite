import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { answerQueryBuildersByTable } from "@tests/fixtures/builders/fake-query-builder.builder"
import type { FakeQueryBuilder, QueryBuilderAnswers } from "@tests/fixtures/builders/fake-query-builder.builder"
import { DeskDailyService, renewalSectionOf } from "@modules/domain/accounting"
import type { RenewalCashReport } from "@modules/domain/accounting"
import { ACCOUNT_DIRECTORY } from "@modules/domain/workspace-members"
import type { AccountDirectory } from "@modules/domain/workspace-members"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
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

/** The query builders of a spec: the answers by table and the doubles that were built, to inspect. */
const queries = (answers: Readonly<Record<string, QueryBuilderAnswers>>) => {
    const em = mockEntityManager()
    const built = answerQueryBuildersByTable(em, answers)
    return { em, built }
}

/** The double built for a table (and alias), or undefined when none was. */
const builtFor = (
    built: ReadonlyArray<FakeQueryBuilder>,
    table: string,
    alias?: string,
): FakeQueryBuilder | undefined =>
    built.find((builder) =>
        builder.argsOf("from").some((args) => args[0] === table && (alias === undefined || args[1] === alias)),
    )

const build = async (em: MockEntityManager) => {
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
    const moduleRef = await Test.createTestingModule({
        providers: [
            N8nDataService,
            { provide: DeskDailyService, useValue: desk },
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: ACCOUNT_DIRECTORY, useValue: accounts },
        ],
    }).compile()
    return moduleRef.get(N8nDataService)
}

describe("N8nDataService", () => {
    describe("shopName", () => {
        it("answers the name of the shop, or NIVO when it has none", async () => {
            const named = await build(queries({ "public.workspaces": { getRawOne: { name: "Tiem Hoa" } } }).em)
            const unnamed = await build(queries({ "public.workspaces": { getRawOne: undefined } }).em)

            await expect(named.shopName("ws-1")).resolves.toBe("Tiem Hoa")
            await expect(unnamed.shopName("ws-1")).resolves.toBe("NIVO")
        })
    })

    describe("ownerRecipients", () => {
        it("answers the owners and managers who have an address, in lower case", async () => {
            const members = [
                { userId: "u-1", displayName: "Lan" },
                { userId: "u-2", displayName: "No address" },
                { userId: "u-3", displayName: "Unknown" },
            ]
            const { em, built } = queries({ "public.workspace_members": { getRawMany: members } })
            const service = await build(em)

            await expect(service.ownerRecipients("ws-1")).resolves.toEqual([{ email: "owner@shop.vn", name: "Lan" }])

            expect(builtFor(built, "public.workspace_members")?.argsOf("limit")).toEqual([[50]])
        })
    })
})

describe("N8nDataService", () => {
    describe("dailySummary", () => {
        const answers: Readonly<Record<string, QueryBuilderAnswers>> = {
            "public.leads l": { getRawOne: { total: 2, amount: 0 } },
            "public.orders o": { getRawOne: { total: 1, amount: 0 } },
            "public.transactions t": { getRawOne: { total: 1, amount: "500000" } },
            "public.invoices i": { getRawOne: { total: 2, amount: "700000" } },
            "public.work_items w": { getRawOne: { total: 3, amount: 0 } },
            "public.invoices d": { getRawOne: { total: 1, amount: "200000" } },
            "public.workspaces": { getRawOne: { name: "Tiem Hoa" } },
            "public.workspace_members": { getRawMany: [] },
        }

        it("reports the figures of the named day in words, with what waits and what is overdue", async () => {
            const { em, built } = queries(answers)
            const service = await build(em)

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
            const range = { workspaceId: "ws-1", from: "2026-10-10T17:00:00.000Z", to: "2026-10-11T17:00:00.000Z" }
            expect(builtFor(built, "public.leads", "l")?.argsOf("where")[0]?.[1]).toEqual(range)
            expect(builtFor(built, "public.invoices", "d")?.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                now: NOW,
            })
        })

        it("reports an empty day: today, nothing overdue, nothing waiting", async () => {
            const { em } = queries({
                "public.leads l": { getRawOne: undefined },
                "public.orders o": { getRawOne: undefined },
                "public.transactions t": { getRawOne: undefined },
                "public.invoices i": { getRawOne: undefined },
                "public.work_items w": { getRawOne: undefined },
                "public.invoices d": { getRawOne: undefined },
                "public.workspaces": { getRawOne: undefined },
                "public.workspace_members": { getRawMany: [] },
            })
            const service = await build(em)

            const summary = await service.dailySummary("ws-1", null)

            expect(summary.date).toBe("2026-10-12")
            expect(summary.numbers).toMatchObject({ new_leads: 0, money_in: 0, overdue_count: 0 })
            expect(summary.variables.viec_cho).toBe("waitingNone{}")
            expect(summary.variables.tom_tat).toContain('overdue{"count":0}')
        })
    })
})

const OVERDUE_INVOICES = [
    {
        id: "i-1",
        invoiceNo: "HD1",
        amountVnd: "100000",
        dueAt: new Date("2026-10-01T00:00:00Z"),
        leadId: "l-1",
    },
    { id: "i-2", invoiceNo: "HD2", amountVnd: "200000", dueAt: null, leadId: "l-2" },
    {
        id: "i-3",
        invoiceNo: "HD3",
        amountVnd: "300000",
        dueAt: new Date("2026-10-02T00:00:00Z"),
        leadId: "l-3",
    },
    { id: "i-4", invoiceNo: "HD4", amountVnd: "400000", dueAt: new Date("2026-10-02T00:00:00Z"), leadId: null },
]

const OVERDUE_LEADS = [
    { id: "l-1", contactName: "An", email: "An@Mail.com" },
    { id: "l-2", contactName: "Binh", email: "binh@mail.com" },
    { id: "l-3", contactName: "Chi", email: null },
]

describe("N8nDataService", () => {
    describe("overdueInvoices", () => {
        it("lists reminders for addressed invoices not reminded lately and counts the others", async () => {
            const { em, built } = queries({
                "public.invoices i": { getRawMany: OVERDUE_INVOICES },
                "public.leads l": { getRawMany: OVERDUE_LEADS },
                "public.email_messages e": { getRawMany: [{ invoiceId: "i-2" }] },
                "public.workspaces": { getRawOne: { name: "Tiem Hoa" } },
            })
            const service = await build(em)

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
            expect(builtFor(built, "public.invoices")?.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                cutoff: "2026-10-07T10:00:00.000Z",
            })
            expect(builtFor(built, "public.email_messages")?.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                since: "2026-10-02T10:00:00.000Z",
            })
            expect(builtFor(built, "public.leads")?.argsOf("where")).toEqual([
                ["l.id IN (:...ids)", { ids: ["l-1", "l-2", "l-3"] }],
            ])
        })

        it("uses default delays, skips absent leads and treats missing due dates as due now", async () => {
            const { em, built } = queries({
                "public.invoices i": { getRawMany: [{ ...OVERDUE_INVOICES[3], leadId: null }] },
                "public.email_messages e": { getRawMany: [] },
                "public.workspaces": { getRawOne: undefined },
            })
            const service = await build(em)

            const result = await service.overdueInvoices("ws-1", {})

            expect(result).toEqual({ shop_name: "NIVO", items: [], skipped: { no_email: 1, reminded_recently: 0 } })
            expect(builtFor(built, "public.invoices")?.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                cutoff: "2026-10-09T10:00:00.000Z",
            })
            expect(builtFor(built, "public.leads")).toBeUndefined()
        })
    })
})

describe("N8nDataService", () => {
    describe("overdueInvoices", () => {
        const invoices = [
            {
                id: "i-1",
                invoiceNo: "HD1",
                amountVnd: "100000",
                dueAt: new Date("2026-10-01T00:00:00Z"),
                leadId: "l-1",
            },
            { id: "i-2", invoiceNo: "HD2", amountVnd: "200000", dueAt: null, leadId: "l-2" },
        ]

        const leads = [
            { id: "l-1", contactName: "An", email: "An@Mail.com" },
            { id: "l-2", contactName: "Binh", email: "binh@mail.com" },
            { id: "l-3", contactName: "Chi", email: null },
        ]

        it("dates an invoice with no due date today", async () => {
            const { em } = queries({
                "public.invoices i": { getRawMany: [{ ...invoices[1] }] },
                "public.leads l": { getRawMany: leads },
                "public.email_messages e": { getRawMany: [] },
                "public.workspaces": { getRawOne: undefined },
            })
            const service = await build(em)

            const result = await service.overdueInvoices("ws-1", {})

            expect(result.items[0]?.variables).toMatchObject({ han: "12/10/2026", so_ngay_tre: 0 })
        })

        it("keeps at most fifty reminders", async () => {
            const many = Array.from({ length: 60 }, (_item, index) => ({
                id: `i-${index}`,
                invoiceNo: `HD${index}`,
                amountVnd: "1000",
                dueAt: new Date("2026-10-01T00:00:00Z"),
                leadId: "l-1",
            }))
            const { em } = queries({
                "public.invoices i": { getRawMany: many },
                "public.leads l": { getRawMany: leads },
                "public.email_messages e": { getRawMany: [] },
                "public.workspaces": { getRawOne: undefined },
            })
            const service = await build(em)

            await expect(service.overdueInvoices("ws-1", {})).resolves.toMatchObject({ items: anyOf(Array) })
            expect((await service.overdueInvoices("ws-1", {})).items).toHaveLength(50)
        })
    })
})

describe("N8nDataService", () => {
    describe("monthLedger", () => {
        it("writes a month of payments and invoices as csv, with the totals as variables", async () => {
            const { em, built } = queries({
                "public.transactions t": {
                    getRawMany: [
                        {
                            occurredAt: new Date("2026-09-05T03:00:00Z"),
                            amountVnd: "100000",
                            reference: "R1",
                            payer: "An",
                            channel: "bank",
                            status: "ok",
                        },
                    ],
                },
                "public.invoices i": {
                    getRawMany: [
                        {
                            invoiceNo: "HD1",
                            amountVnd: "250000",
                            issuedAt: new Date("2026-09-06T03:00:00Z"),
                            status: "issued",
                        },
                        { invoiceNo: "HD2", amountVnd: "50000", issuedAt: null, status: "draft" },
                    ],
                },
                "public.workspaces": { getRawOne: { name: "Tiem Hoa" } },
            })
            const service = await build(em)

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
            expect(builtFor(built, "public.transactions")?.argsOf("where")[0]?.[1]).toEqual({
                workspaceId: "ws-1",
                from: "2026-08-31T17:00:00.000Z",
                to: "2026-09-30T17:00:00.000Z",
            })
            expect(builtFor(built, "public.transactions")?.argsOf("limit")).toEqual([[5000]])
        })

        it("reads last month when none is named", async () => {
            const { em } = queries({
                "public.transactions t": { getRawMany: [] },
                "public.invoices i": { getRawMany: [] },
                "public.workspaces": { getRawOne: undefined },
            })
            const service = await build(em)

            await expect(service.monthLedger("ws-1", null)).resolves.toMatchObject({ period: "2026-09", rows: 0 })
        })
    })
})

describe("N8nDataService", () => {
    describe("paymentReceipt", () => {
        const invoice = {
            id: "i-1",
            invoiceNo: "HD1",
            amountVnd: "250000",
            leadId: "l-1",
            paidAt: new Date("2026-10-10T03:00:00Z"),
        }

        const lead = { id: "l-1", contactName: "An", email: "An@Mail.com" }

        const payment = { invoiceId: "i-1", amountVnd: "100000", occurredAt: new Date("2026-10-11T03:00:00Z") }

        it("answers nothing without a payment or an invoice", async () => {
            const { em } = queries({})
            const service = await build(em)

            await expect(service.paymentReceipt("ws-1", "", "")).resolves.toBeNull()

            expect(em.createQueryBuilder).not.toHaveBeenCalled()
        })

        it("answers the receipt of a payment matched to an invoice, once per payment", async () => {
            const { em } = queries({
                "public.transactions t": { getRawOne: payment },
                "public.invoices i": { getRawOne: invoice },
                "public.leads l": { getRawMany: [lead] },
                "public.workspaces": { getRawOne: { name: "Tiem Hoa" } },
            })
            const service = await build(em)

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
            const { em, built } = queries({
                "public.invoices i": { getRawOne: invoice },
                "public.leads l": { getRawMany: [lead] },
                "public.workspaces": { getRawOne: { name: "Tiem Hoa" } },
            })
            const service = await build(em)

            const receipt = await service.paymentReceipt("ws-1", "", "i-1")

            expect(receipt).toMatchObject({
                dedupe: "receipt:i-1",
                data: { refs: { transaction_id: null }, variables: { ngay: "10/10/2026" } },
            })
            expect(builtFor(built, "public.transactions")).toBeUndefined()
        })
    })
})

describe("N8nDataService", () => {
    describe("paymentReceipt", () => {
        const invoice = {
            id: "i-1",
            invoiceNo: "HD1",
            amountVnd: "250000",
            leadId: "l-1",
            paidAt: new Date("2026-10-10T03:00:00Z"),
        }

        const lead = { id: "l-1", contactName: "An", email: "An@Mail.com" }

        const payment = { invoiceId: "i-1", amountVnd: "100000", occurredAt: new Date("2026-10-11T03:00:00Z") }

        it("dates the receipt today when neither the payment nor the invoice has a date", async () => {
            const { em } = queries({
                "public.invoices i": { getRawOne: { ...invoice, paidAt: null } },
                "public.leads l": { getRawMany: [lead] },
                "public.workspaces": { getRawOne: undefined },
            })
            const service = await build(em)

            await expect(service.paymentReceipt("ws-1", "", "i-1")).resolves.toMatchObject({
                data: { variables: { ngay: "12/10/2026" } },
            })
        })

        it("answers nothing when the payment is not matched to an invoice", async () => {
            const matchless = await build(
                queries({ "public.transactions t": { getRawOne: { ...payment, invoiceId: null } } }).em,
            )
            const unknown = await build(queries({ "public.transactions t": { getRawOne: undefined } }).em)

            await expect(matchless.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
            await expect(unknown.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
        })

        it("answers nothing when the invoice is unknown or has no customer", async () => {
            const none = await build(queries({ "public.invoices i": { getRawOne: undefined } }).em)
            const anonymous = await build(
                queries({ "public.invoices i": { getRawOne: { ...invoice, leadId: null } } }).em,
            )

            await expect(none.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
            await expect(anonymous.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        })

        it("answers nothing when the customer has no address", async () => {
            const service = await build(
                queries({
                    "public.invoices i": { getRawOne: invoice },
                    "public.leads l": { getRawMany: [{ ...lead, email: null }] },
                }).em,
            )
            const missing = await build(
                queries({
                    "public.invoices i": { getRawOne: invoice },
                    "public.leads l": { getRawMany: [] },
                }).em,
            )

            await expect(service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
            await expect(missing.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        })
    })
})
