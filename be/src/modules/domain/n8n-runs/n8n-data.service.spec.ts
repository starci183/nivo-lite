import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
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

/** A pattern matcher, typed `unknown` so it flows into any slot. */
const stringMatch = (pattern: RegExp | string): unknown => expect.stringMatching(pattern)

/** The match-anything matcher, typed `unknown` so it flows into any slot. */
const anything = (): unknown => expect.anything()

/** A by-constructor matcher, typed `unknown` so it flows into any slot. */
const anyOf = (type: unknown): unknown => expect.any(type)

const NOW = "2026-10-12T10:00:00.000Z"
const RENEWAL_REPORT = mock<RenewalCashReport>({ lines: ["   - Renewal line"] })

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
            const named = await build(mockEntityManager({ query: [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]] }))
            const unnamed = await build(mockEntityManager({ query: [SELECT_SHOP_NAME, []] }))

            await expect(named.shopName("ws-1")).resolves.toBe("Tiem Hoa")
            await expect(unnamed.shopName("ws-1")).resolves.toBe("NIVO")
        })
    })

    describe("ownerRecipients", () => {
        it("answers the owners and managers who have an address, in lower case", async () => {
            const members = [
                { user_id: "u-1", display_name: "Lan" },
                { user_id: "u-2", display_name: "No address" },
                { user_id: "u-3", display_name: "Unknown" },
            ]
            const service = await build(mockEntityManager({ query: [SELECT_OWNER_MEMBERS, members] }))

            await expect(service.ownerRecipients("ws-1")).resolves.toEqual([{ email: "owner@shop.vn", name: "Lan" }])
        })
    })
})

describe("N8nDataService", () => {
    describe("dailySummary", () => {
        const numbers = {
            new_leads: 2,
            orders_confirmed: 1,
            money_in: "500000",
            money_in_count: 1,
            invoiced: "700000",
            invoices_issued: 2,
            waiting_decisions: 3,
            overdue_count: 1,
            overdue_total: "200000",
        }

        it("reports the figures of the named day in words, with what waits and what is overdue", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_DAY_NUMBERS, [numbers]],
                    [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]],
                    [SELECT_OWNER_MEMBERS, []],
                ],
            })
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
            expect(em.query).toHaveBeenCalledWith(SELECT_DAY_NUMBERS, [
                "ws-1",
                "2026-10-10T17:00:00.000Z",
                "2026-10-11T17:00:00.000Z",
                NOW,
            ])
        })

        it("reports an empty day: today, nothing overdue, nothing waiting", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_DAY_NUMBERS, []],
                    [SELECT_SHOP_NAME, []],
                    [SELECT_OWNER_MEMBERS, []],
                ],
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

describe("N8nDataService", () => {
    describe("overdueInvoices", () => {
        const invoices = [
            { id: "i-1", invoice_no: "HD1", amount_vnd: "100000", due_at: "2026-10-01T00:00:00Z", lead_id: "l-1" },
            { id: "i-2", invoice_no: "HD2", amount_vnd: "200000", due_at: null, lead_id: "l-2" },
            { id: "i-3", invoice_no: "HD3", amount_vnd: "300000", due_at: "2026-10-02T00:00:00Z", lead_id: "l-3" },
            { id: "i-4", invoice_no: "HD4", amount_vnd: "400000", due_at: "2026-10-02T00:00:00Z", lead_id: null },
        ]

        const leads = [
            { id: "l-1", contact_name: "An", email: "An@Mail.com" },
            { id: "l-2", contact_name: "Binh", email: "binh@mail.com" },
            { id: "l-3", contact_name: "Chi", email: null },
        ]

        it("lists reminders for addressed invoices not reminded lately and counts the others", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_OVERDUE_INVOICES, invoices],
                    [SELECT_LEAD_CONTACTS, leads],
                    [SELECT_REMINDED_INVOICES, [{ invoice_id: "i-2" }]],
                    [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]],
                ],
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
            expect(em.query).toHaveBeenCalledWith(SELECT_OVERDUE_INVOICES, ["ws-1", "2026-10-07T10:00:00.000Z"])
            expect(em.query).toHaveBeenCalledWith(SELECT_REMINDED_INVOICES, ["ws-1", "2026-10-02T10:00:00.000Z"])
        })

        it("uses default delays, skips absent leads and treats missing due dates as due now", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_OVERDUE_INVOICES, [{ ...invoices[3], lead_id: null }]],
                    [SELECT_REMINDED_INVOICES, []],
                    [SELECT_SHOP_NAME, []],
                ],
            })
            const service = await build(em)

            const result = await service.overdueInvoices("ws-1", {})

            expect(result).toEqual({ shop_name: "NIVO", items: [], skipped: { no_email: 1, reminded_recently: 0 } })
            expect(em.query).toHaveBeenCalledWith(SELECT_OVERDUE_INVOICES, ["ws-1", "2026-10-09T10:00:00.000Z"])
            expect(em.query).not.toHaveBeenCalledWith(SELECT_LEAD_CONTACTS, anything())
        })
    })
})

describe("N8nDataService", () => {
    describe("overdueInvoices", () => {
        const invoices = [
            { id: "i-1", invoice_no: "HD1", amount_vnd: "100000", due_at: "2026-10-01T00:00:00Z", lead_id: "l-1" },
            { id: "i-2", invoice_no: "HD2", amount_vnd: "200000", due_at: null, lead_id: "l-2" },
            { id: "i-3", invoice_no: "HD3", amount_vnd: "300000", due_at: "2026-10-02T00:00:00Z", lead_id: "l-3" },
            { id: "i-4", invoice_no: "HD4", amount_vnd: "400000", due_at: "2026-10-02T00:00:00Z", lead_id: null },
        ]

        const leads = [
            { id: "l-1", contact_name: "An", email: "An@Mail.com" },
            { id: "l-2", contact_name: "Binh", email: "binh@mail.com" },
            { id: "l-3", contact_name: "Chi", email: null },
        ]

        it("dates an invoice with no due date today", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_OVERDUE_INVOICES, [{ ...invoices[1] }]],
                    [SELECT_LEAD_CONTACTS, leads],
                    [SELECT_REMINDED_INVOICES, []],
                    [SELECT_SHOP_NAME, []],
                ],
            })
            const service = await build(em)

            const result = await service.overdueInvoices("ws-1", {})

            expect(result.items[0]?.variables).toMatchObject({ han: "12/10/2026", so_ngay_tre: 0 })
        })

        it("keeps at most fifty reminders", async () => {
            const many = Array.from({ length: 60 }, (_item, index) => ({
                id: `i-${index}`,
                invoice_no: `HD${index}`,
                amount_vnd: "1000",
                due_at: "2026-10-01T00:00:00Z",
                lead_id: "l-1",
            }))
            const service = await build(
                mockEntityManager({
                    query: [
                        [SELECT_OVERDUE_INVOICES, many],
                        [SELECT_LEAD_CONTACTS, leads],
                        [SELECT_REMINDED_INVOICES, []],
                        [SELECT_SHOP_NAME, []],
                    ],
                }),
            )

            await expect(service.overdueInvoices("ws-1", {})).resolves.toMatchObject({ items: anyOf(Array) })
            expect((await service.overdueInvoices("ws-1", {})).items).toHaveLength(50)
        })
    })
})

describe("N8nDataService", () => {
    describe("monthLedger", () => {
        it("writes a month of payments and invoices as csv, with the totals as variables", async () => {
            const em = mockEntityManager({
                query: [
                    [
                        SELECT_LEDGER_TRANSACTIONS,
                        [
                            {
                                occurred_at: "2026-09-05T03:00:00Z",
                                amount_vnd: "100000",
                                reference: "R1",
                                payer: "An",
                                channel: "bank",
                                status: "ok",
                            },
                        ],
                    ],
                    [
                        SELECT_LEDGER_INVOICES,
                        [
                            {
                                invoice_no: "HD1",
                                amount_vnd: "250000",
                                issued_at: "2026-09-06T03:00:00Z",
                                status: "issued",
                            },
                            { invoice_no: "HD2", amount_vnd: "50000", issued_at: null, status: "draft" },
                        ],
                    ],
                    [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]],
                ],
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
            expect(em.query).toHaveBeenCalledWith(SELECT_LEDGER_TRANSACTIONS, [
                "ws-1",
                "2026-08-31T17:00:00.000Z",
                "2026-09-30T17:00:00.000Z",
            ])
        })

        it("reads last month when none is named", async () => {
            const em = mockEntityManager({
                query: [
                    [SELECT_LEDGER_TRANSACTIONS, []],
                    [SELECT_LEDGER_INVOICES, []],
                    [SELECT_SHOP_NAME, []],
                ],
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
            invoice_no: "HD1",
            amount_vnd: "250000",
            lead_id: "l-1",
            paid_at: "2026-10-10T03:00:00Z",
        }

        const lead = { id: "l-1", contact_name: "An", email: "An@Mail.com" }

        const payment = { invoice_id: "i-1", amount_vnd: "100000", occurred_at: "2026-10-11T03:00:00Z" }

        it("answers nothing without a payment or an invoice", async () => {
            const service = await build(mockEntityManager())

            await expect(service.paymentReceipt("ws-1", "", "")).resolves.toBeNull()
        })

        it("answers the receipt of a payment matched to an invoice, once per payment", async () => {
            const service = await build(
                mockEntityManager({
                    query: [
                        [SELECT_RECEIPT_TRANSACTION, [payment]],
                        [SELECT_RECEIPT_INVOICE, [invoice]],
                        [SELECT_LEAD_CONTACTS, [lead]],
                        [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]],
                    ],
                }),
            )

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
            const service = await build(
                mockEntityManager({
                    query: [
                        [SELECT_RECEIPT_INVOICE, [invoice]],
                        [SELECT_LEAD_CONTACTS, [lead]],
                        [SELECT_SHOP_NAME, [{ name: "Tiem Hoa" }]],
                    ],
                }),
            )

            const receipt = await service.paymentReceipt("ws-1", "", "i-1")

            expect(receipt).toMatchObject({
                dedupe: "receipt:i-1",
                data: { refs: { transaction_id: null }, variables: { ngay: "10/10/2026" } },
            })
        })
    })
})

describe("N8nDataService", () => {
    describe("paymentReceipt", () => {
        const invoice = {
            id: "i-1",
            invoice_no: "HD1",
            amount_vnd: "250000",
            lead_id: "l-1",
            paid_at: "2026-10-10T03:00:00Z",
        }

        const lead = { id: "l-1", contact_name: "An", email: "An@Mail.com" }

        const payment = { invoice_id: "i-1", amount_vnd: "100000", occurred_at: "2026-10-11T03:00:00Z" }

        it("dates the receipt today when neither the payment nor the invoice has a date", async () => {
            const service = await build(
                mockEntityManager({
                    query: [
                        [SELECT_RECEIPT_INVOICE, [{ ...invoice, paid_at: null }]],
                        [SELECT_LEAD_CONTACTS, [lead]],
                        [SELECT_SHOP_NAME, []],
                    ],
                }),
            )

            await expect(service.paymentReceipt("ws-1", "", "i-1")).resolves.toMatchObject({
                data: { variables: { ngay: "12/10/2026" } },
            })
        })

        it("answers nothing when the payment is not matched to an invoice", async () => {
            const service = await build(
                mockEntityManager({ query: [SELECT_RECEIPT_TRANSACTION, [{ ...payment, invoice_id: null }]] }),
            )
            const unknown = await build(mockEntityManager({ query: [SELECT_RECEIPT_TRANSACTION, []] }))

            await expect(service.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
            await expect(unknown.paymentReceipt("ws-1", "t-1", "")).resolves.toBeNull()
        })

        it("answers nothing when the invoice is unknown or has no customer", async () => {
            const none = await build(mockEntityManager({ query: [SELECT_RECEIPT_INVOICE, []] }))
            const anonymous = await build(
                mockEntityManager({ query: [SELECT_RECEIPT_INVOICE, [{ ...invoice, lead_id: null }]] }),
            )

            await expect(none.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
            await expect(anonymous.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        })

        it("answers nothing when the customer has no address", async () => {
            const service = await build(
                mockEntityManager({
                    query: [
                        [SELECT_RECEIPT_INVOICE, [invoice]],
                        [SELECT_LEAD_CONTACTS, [{ ...lead, email: null }]],
                    ],
                }),
            )
            const missing = await build(
                mockEntityManager({
                    query: [
                        [SELECT_RECEIPT_INVOICE, [invoice]],
                        [SELECT_LEAD_CONTACTS, []],
                    ],
                }),
            )

            await expect(service.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
            await expect(missing.paymentReceipt("ws-1", "", "i-1")).resolves.toBeNull()
        })
    })
})
