import { Test } from "@nestjs/testing"
import type { DailySummaryInput, UpcomingDue } from "./accounting-desk.contracts"
import {
    bankCounts,
    buildDailySummary,
    dayText,
    dueLine,
    renewalLines,
    renewalReport,
    renewalSectionOf,
    renewalStoryOf,
    summaryHubCard,
    summarySources,
    withRenewal,
} from "./daily-summary.policy"
import { CARD_COPY, RENEWAL_COPY, SUMMARY_COPY, kindText } from "./messages/accounting-desk.messages"
import type { RenewalCashFacts, RenewalPaidItemFacts } from "./renewal-cash.contracts"

const SUBJECT = Symbol("daily-summary.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: SUBJECT, useValue: { bankCounts, buildDailySummary, dueLine, summaryHubCard, summarySources } },
        ],
    }).compile()
    return moduleRef.get<typeof import("./daily-summary.policy")>(SUBJECT)
}

const due = (daysLeft: number, kind: UpcomingDue["kind"] = "vat"): UpcomingDue => ({
    source: kind === "supplier_payment" ? "supplier" : "tax",
    kind,
    ref: "2026-Q3",
    dueOn: "2026-11-02",
    daysLeft,
    amountVnd: null,
    note: "",
})

const input = (overrides: Partial<DailySummaryInput> = {}): DailySummaryInput => ({
    day: "2026-10-20",
    valid: 38,
    needsReview: 3,
    invalidTaxCode: 1,
    matched: 18,
    unmatched: 1,
    upcoming: [due(-2, "supplier_payment"), due(13), due(20), due(21), due(22), due(23)],
    tools: { invoices: "inbox.invoices.list", credits: "bank.transactions.list", receivables: null },
    notConnected: [],
    ...overrides,
})

describe("daily-summary.policy", () => {
    it("builds the card with the counts, the bank line and the next deadline", async () => {
        const subject = await build()

        const card = subject.buildDailySummary(input())

        expect(card).toEqual(
            expect.objectContaining({
                kind: "daily_summary",
                room: "accounting",
                day: "2026-10-20",
                stats: { valid: 38, needsReview: 3, invalidTaxCode: 1 },
                bank: { matched: 18, unmatched: 1 },
                next: due(13),
            }),
        )
        expect(card.upcoming).toHaveLength(5)
        expect(card.text).toBe(
            [
                SUMMARY_COPY.headline(5),
                SUMMARY_COPY.stats(input()),
                SUMMARY_COPY.bank(input()),
                SUMMARY_COPY.next(due(13), kindText("vat")),
            ].join("\n"),
        )
        expect(subject.dueLine(due(3))).toBe(SUMMARY_COPY.next(due(3), kindText("vat")))
    })

    it("says a feature that did not run is not connected, on the card and in the text", async () => {
        const subject = await build()

        const card = subject.buildDailySummary(input({ notConnected: ["receivables"] }))

        expect(card.hub.lines?.[0]).toEqual({ text: CARD_COPY.notConnected(CARD_COPY.sourceReceivables) })
        expect(card.text).toContain(CARD_COPY.notConnected(CARD_COPY.sourceReceivables))
    })

    it("says when nothing is due", async () => {
        const subject = await build()

        const quiet = subject.buildDailySummary(
            input({ needsReview: 0, invalidTaxCode: 0, unmatched: 0, upcoming: [] }),
        )

        expect(quiet.next).toBeNull()
        expect(quiet.headline).toBe(SUMMARY_COPY.headline(0))
        expect(quiet.text.endsWith(SUMMARY_COPY.none)).toBe(true)
    })
})

describe("daily-summary.policy hub card and counts", () => {
    it("carries the tiles as fields and the next dues as lines in the hub card", async () => {
        const subject = await build()

        const card = subject.buildDailySummary(input())

        expect(card.hub).toEqual(
            expect.objectContaining({
                v: 1,
                type: "daily_summary",
                title: CARD_COPY.summaryTitle,
                subtitle: "2026-10-20",
            }),
        )
        expect(card.hub.fields?.map((field) => field.value)).toEqual(["38", "3", "1", "18", "1"])
        expect(card.hub.lines?.[1]).toEqual({ at: "2026-11-02", text: CARD_COPY.dueAt(due(13), kindText("vat")) })
        expect(card.hub.lines).toHaveLength(5)
    })

    it("cites each tool that answered by its resolved name, leaves out a role nothing answered, then the brain and base sources", async () => {
        const subject = await build()

        expect(subject.summarySources(input().tools)).toEqual([
            {
                layer: 1,
                kind: "mcp_tool",
                ref: "inbox.invoices.list",
                label: CARD_COPY.toolSource(CARD_COPY.sourceInvoices, "inbox.invoices.list"),
            },
            {
                layer: 1,
                kind: "mcp_tool",
                ref: "bank.transactions.list",
                label: CARD_COPY.toolSource(CARD_COPY.sourceCredits, "bank.transactions.list"),
            },
            { layer: 2, kind: "brain_fact", ref: "tax_profile", label: CARD_COPY.sourceTaxProfile },
            { layer: 4, kind: "base_document", ref: "tax-calendar-vn", label: CARD_COPY.sourceTaxCalendar },
        ])
    })

    it("counts the matched credits, those a receivable just took, and those still waiting", async () => {
        const subject = await build()
        const credit = (matched: boolean) => ({ creditRef: "r", reference: "", amountVnd: 1, occurredAt: "", matched })

        expect(subject.bankCounts([credit(true), credit(false), credit(false), credit(false)], 1)).toEqual({
            matched: 2,
            unmatched: 2,
        })
    })
})

const EMPTY_ROW: RenewalCashFacts = {
    issued_count: 0,
    issued_total: 0,
    issued: [],
    paid_count: 0,
    paid_total: 0,
    paid: [],
    unpaid_count: 0,
    unpaid_total: 0,
    unpaid: [],
    expiring_count: 0,
    expiring_total: 0,
    expiring: [],
    unmatched_count: 0,
    unmatched_total: 0,
    unmatched: [],
}

const PAID_ITEM: RenewalPaidItemFacts = {
    invoice_no: "INV-202610-0001",
    amount_vnd: 2_160_000,
    customer_name: "Truong Phat",
    ends_on: "2027-11-29",
    extended: true,
}

const RENEWAL_DAY: RenewalCashFacts = {
    issued_count: 2,
    issued_total: 3_780_000,
    issued: [
        { invoice_no: "INV-202610-0001", amount_vnd: 2_160_000, customer_name: "Truong Phat" },
        { invoice_no: "INV-202610-0002", amount_vnd: 1_620_000, customer_name: "Hai Thanh" },
    ],
    paid_count: 1,
    paid_total: 2_160_000,
    paid: [PAID_ITEM],
    unpaid_count: 2,
    unpaid_total: 2_100_000,
    unpaid: [
        { invoice_no: "INV-202609-0007", amount_vnd: 480_000, customer_name: null, due_on: "2026-10-20" },
        { invoice_no: "INV-202610-0002", amount_vnd: 1_620_000, customer_name: "Hai Thanh", due_on: "2026-11-11" },
    ],
    expiring_count: 7,
    expiring_total: 486_000,
    expiring: ["2026-10-29", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-07"].map(
        (endsOn) => ({ customer_name: "Duy Linh", plan: "Domain", ends_on: endsOn, amount_vnd: 0 }),
    ),
    unmatched_count: 1,
    unmatched_total: 1_620_000,
    unmatched: [{ amount_vnd: 1_620_000, sender_name: null, memo: "INV2026100002 gia han" }],
}

const buildRenewal = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { dayText, renewalLines, renewalReport, renewalSectionOf, renewalStoryOf, withRenewal },
            },
        ],
    }).compile()
    return moduleRef.get<typeof import("./daily-summary.policy")>(SUBJECT)
}

describe("daily-summary.policy renewal story", () => {
    it("says every part of an empty day plainly, with or without a reader row", async () => {
        const subject = await buildRenewal()

        const none = [
            RENEWAL_COPY.issuedNone,
            RENEWAL_COPY.paidNone,
            RENEWAL_COPY.unpaidNone(30),
            RENEWAL_COPY.expiringNone(30),
            RENEWAL_COPY.unmatchedNone,
        ]
        expect(subject.renewalLines(subject.renewalStoryOf(undefined, "2026-10-27", "2026-11-26"))).toEqual(none)
        expect(subject.renewalLines(subject.renewalStoryOf(EMPTY_ROW, "2026-10-27", "2026-11-26"))).toEqual(none)
    })

    it("tells a day with renewals: issued, paid with the new end date, unpaid by due, expiring and unmatched", async () => {
        const subject = await buildRenewal()
        const money = CARD_COPY.money

        const lines = subject.renewalLines(subject.renewalStoryOf(RENEWAL_DAY, "2026-10-27", "2026-11-26"))

        expect(lines).toEqual([
            RENEWAL_COPY.issued(2, money(3_780_000)),
            RENEWAL_COPY.item(["INV-202610-0001", money(2_160_000), "Truong Phat"]),
            RENEWAL_COPY.item(["INV-202610-0002", money(1_620_000), "Hai Thanh"]),
            RENEWAL_COPY.paid(1, money(2_160_000)),
            RENEWAL_COPY.item([
                "INV-202610-0001",
                money(2_160_000),
                "Truong Phat",
                RENEWAL_COPY.extended("29/11/2027"),
            ]),
            RENEWAL_COPY.unpaid(2, money(2_100_000), 30),
            RENEWAL_COPY.item(["INV-202609-0007", money(480_000), "", RENEWAL_COPY.overdueSince("20/10/2026")]),
            RENEWAL_COPY.item(["INV-202610-0002", money(1_620_000), "Hai Thanh", RENEWAL_COPY.dueOn("11/11/2026")]),
            RENEWAL_COPY.expiring(7, 30),
            ...["29/10/2026", "01/11/2026", "02/11/2026", "03/11/2026", "04/11/2026"].map((day) =>
                RENEWAL_COPY.item(["Duy Linh", "Domain", RENEWAL_COPY.endsOn(day)]),
            ),
            RENEWAL_COPY.more(2),
            RENEWAL_COPY.unmatched(1, money(1_620_000)),
            RENEWAL_COPY.item([money(1_620_000), RENEWAL_COPY.memo("INV2026100002 gia han"), ""]),
        ])
        expect(lines[4]).toContain("INV-202610-0001 · 2.160.000 ₫")
        expect(lines[4]).toContain("29/11/2027")
        expect(lines[6]).not.toContain("·  ·")
    })
})

describe("daily-summary.policy renewal wording", () => {
    it("says a paid renewal whose contract did not move is not extended", async () => {
        const subject = await buildRenewal()
        const row = { ...RENEWAL_DAY, paid: [{ ...PAID_ITEM, ends_on: "2026-11-29", extended: false }] }

        const lines = subject.renewalLines(subject.renewalStoryOf(row, "2026-10-27", "2026-11-26"))

        expect(lines[4]).toContain(RENEWAL_COPY.notExtended("29/11/2026"))
    })

    it("formats amounts in the Vietnamese grouping with the dong sign and days as dd/mm/yyyy", async () => {
        const subject = await buildRenewal()

        expect(CARD_COPY.money(2_160_000)).toBe("2.160.000 ₫")
        expect(CARD_COPY.money(0)).toBe("0 ₫")
        expect(subject.dayText("2027-11-29")).toBe("29/11/2027")
        const story = subject.renewalStoryOf(
            { ...EMPTY_ROW, paid_count: 1, paid_total: 1_620_000 },
            "2026-10-27",
            "2026-11-26",
        )
        expect(subject.renewalLines(story)[1]).toBe(RENEWAL_COPY.paid(1, "1.620.000 ₫"))
    })

    it("adds the story to the morning card: tiles, lines within the card bound, the data and the text", async () => {
        const subject = await buildRenewal()
        const card = buildDailySummary(input())
        const report = subject.renewalReport(subject.renewalStoryOf(RENEWAL_DAY, "2026-10-27", "2026-11-26"))

        const told = subject.withRenewal(card, report)

        expect(told.hub.fields?.slice(5).map((field) => field.label)).toEqual([
            RENEWAL_COPY.fieldIssued,
            RENEWAL_COPY.fieldPaid,
            RENEWAL_COPY.fieldUnpaid,
            RENEWAL_COPY.fieldExpiring,
            RENEWAL_COPY.fieldUnmatched,
        ])
        expect(told.hub.fields?.[6]?.value).toBe(RENEWAL_COPY.tally(1, CARD_COPY.money(2_160_000)))
        expect(told.hub.lines).toHaveLength(20)
        expect(told.hub.lines?.[5]).toEqual({ text: report.lines[0] })
        expect(told.hub.data).toEqual(expect.objectContaining({ day: "2026-10-20", renewal: report.story }))
        expect(told.text).toBe([card.text, RENEWAL_COPY.heading, ...report.lines].join("\n"))
    })
})

describe("daily-summary.policy renewal gaps", () => {
    it("reads missing names, plans, amounts and memos as empty text", async () => {
        const subject = await buildRenewal()
        const row: RenewalCashFacts = {
            ...EMPTY_ROW,
            issued_count: 1,
            issued: [{ invoice_no: "INV-1", amount_vnd: 100, customer_name: null }],
            paid_count: 1,
            paid: [{ ...PAID_ITEM, customer_name: null }],
            expiring_count: 1,
            expiring: [{ customer_name: "Duy Linh", plan: null, ends_on: "2026-11-01", amount_vnd: null }],
            unmatched_count: 1,
            unmatched: [{ amount_vnd: null, sender_name: "Hai Thanh", memo: null }],
        }

        const story = subject.renewalStoryOf(row, "2026-10-27", "2026-11-26")

        expect(story.issued.items).toEqual([{ invoiceNo: "INV-1", amountVnd: 100, customer: "" }])
        expect(story.paid.items[0]?.customer).toBe("")
        expect(story.expiring.items).toEqual([{ customer: "Duy Linh", plan: "", endsOn: "2026-11-01" }])
        expect(story.unmatched.items).toEqual([{ amountVnd: 0, sender: "Hai Thanh", memo: "" }])
        expect(subject.renewalLines(story).at(-1)).toBe(
            RENEWAL_COPY.item([CARD_COPY.money(0), "", RENEWAL_COPY.from("Hai Thanh")]),
        )
    })

    it("adds the story to a card that has no fields or lines yet", async () => {
        const subject = await buildRenewal()
        const card = buildDailySummary(input())
        const bare = { ...card, hub: { ...card.hub, fields: undefined, lines: undefined } }
        const report = subject.renewalReport(subject.renewalStoryOf(undefined, "2026-10-27", "2026-11-26"))

        const told = subject.withRenewal(bare, report)

        expect(told.hub.fields?.map((field) => field.label)).toEqual([
            RENEWAL_COPY.fieldIssued,
            RENEWAL_COPY.fieldPaid,
            RENEWAL_COPY.fieldUnpaid,
            RENEWAL_COPY.fieldExpiring,
            RENEWAL_COPY.fieldUnmatched,
        ])
        expect(told.hub.lines).toEqual(report.lines.map((text) => ({ text })))
    })
})

describe("daily-summary.policy renewal section", () => {
    it("heads the report lines with the renewal heading", async () => {
        const subject = await buildRenewal()
        const report = subject.renewalReport(subject.renewalStoryOf(undefined, "2026-10-27", "2026-11-26"))

        expect(subject.renewalSectionOf(report)).toBe([RENEWAL_COPY.heading, ...report.lines].join("\n"))
    })
})
