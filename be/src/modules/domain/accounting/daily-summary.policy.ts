import type {
    BankCounts,
    DailySummaryCard,
    HubCardField,
    RenewalCashReport,
    RenewalCashStory,
    RenewalTally,
    DailySummaryInput,
    HubCardPayload,
    DeskFeature,
    HubCardLine,
    HubCardSource,
    SummaryTools,
    UpcomingDue,
} from "./accounting-desk.contracts"
import type { PaymentCredit } from "./accounting-gateway.port"
import { toolSources } from "./card-sources.policy"
import { CARD_COPY, RENEWAL_COPY, SUMMARY_COPY, kindText } from "./messages/accounting-desk.messages"
import type { RenewalCashFacts } from "./renewal-cash.contracts"

const DAY_MS = 86_400_000
/** How many items each part of the renewal story lists before it says how many more there are. */
const RENEWAL_LISTED = 5
/** The most lines a hub card carries (hub-cards v1). */
const HUB_LINES = 20

/**
 * The sources of the morning card (owner ruling: every proposal names its sources): each tool that answered this morning, cited by
 * its resolved name, then the tax profile of the Second Brain and the base tax calendar.
 */
export const summarySources = (tools: SummaryTools): ReadonlyArray<HubCardSource> => [
    ...toolSources([
        { tool: tools.invoices, label: CARD_COPY.sourceInvoices },
        { tool: tools.credits, label: CARD_COPY.sourceCredits },
        { tool: tools.receivables, label: CARD_COPY.sourceReceivables },
    ]),
    { layer: 2, kind: "brain_fact", ref: "tax_profile", label: CARD_COPY.sourceTaxProfile },
    { layer: 4, kind: "base_document", ref: "tax-calendar-vn", label: CARD_COPY.sourceTaxCalendar },
]

/** The label of an optional feature of the desk. */
const FEATURE_LABELS: Readonly<Record<DeskFeature, string>> = {
    invoices: CARD_COPY.sourceInvoices,
    receivables: CARD_COPY.sourceReceivables,
}

/** The "not connected" lines of the features that did not run, said honestly instead of counting zero. */
export const notConnectedLines = (features: ReadonlyArray<DeskFeature>): ReadonlyArray<HubCardLine> =>
    features.map((feature) => ({ text: CARD_COPY.notConnected(FEATURE_LABELS[feature]) }))

/** The line of one upcoming due. */
export const dueLine = (due: UpcomingDue): string => SUMMARY_COPY.next(due, kindText(due.kind))

/** The hub-cards v1 payload of the morning card: tiles as fields, dues as lines. */
export const summaryHubCard = (input: DailySummaryInput, headline: string): HubCardPayload => ({
    v: 1,
    type: "daily_summary",
    title: CARD_COPY.summaryTitle,
    subtitle: input.day,
    body: headline,
    fields: [
        { label: CARD_COPY.valid, value: String(input.valid) },
        { label: CARD_COPY.needsReview, value: String(input.needsReview) },
        { label: CARD_COPY.invalidTaxCode, value: String(input.invalidTaxCode) },
        { label: CARD_COPY.matched, value: String(input.matched) },
        { label: CARD_COPY.unmatched, value: String(input.unmatched) },
    ],
    lines: [
        ...notConnectedLines(input.notConnected),
        ...input.upcoming.slice(0, 5).map((due) => ({ at: due.dueOn, text: CARD_COPY.dueAt(due, kindText(due.kind)) })),
    ],
    sources: summarySources(input.tools),
    data: { day: input.day, upcoming: input.upcoming.slice(0, 5) },
})

/** Builds the `daily_summary` card of the accounting room: the counts, the bank line, the next deadline and a text fallback. */
export const buildDailySummary = (input: DailySummaryInput): DailySummaryCard => {
    const exceptions = input.needsReview + input.invalidTaxCode + input.unmatched
    const next = input.upcoming.find((due) => due.daysLeft >= 0) ?? null
    const headline = SUMMARY_COPY.headline(exceptions)
    const nextLine = next === null ? SUMMARY_COPY.none : dueLine(next)
    return {
        kind: "daily_summary",
        room: "accounting",
        day: input.day,
        headline,
        stats: { valid: input.valid, needsReview: input.needsReview, invalidTaxCode: input.invalidTaxCode },
        bank: { matched: input.matched, unmatched: input.unmatched },
        next,
        upcoming: input.upcoming.slice(0, 5),
        text: [
            headline,
            SUMMARY_COPY.stats(input),
            SUMMARY_COPY.bank(input),
            ...notConnectedLines(input.notConnected).map((line) => line.text),
            nextLine,
        ].join("\n"),
        hub: summaryHubCard(input, headline),
    }
}

/** The credits of the window already reconciled (plus those a receivable just took), and those still waiting for a match. */
export const bankCounts = (credits: ReadonlyArray<PaymentCredit>, recorded: number): BankCounts => {
    const matched = credits.filter((credit) => credit.matched).length + recorded
    return { matched, unmatched: credits.length - matched }
}

/** A day `YYYY-MM-DD` as the owner reads it, `DD/MM/YYYY`. */
export const dayText = (isoDay: string): string => isoDay.split("-").reverse().join("/")

/** A tally of nothing. */
const NONE = { count: 0, totalVnd: 0, items: [] } as const

/** The renewal-to-cash story of the reader row; no row is an empty story. */
export const renewalStoryOf = (
    row: RenewalCashFacts | undefined,
    day: string,
    horizonDay: string,
): RenewalCashStory => {
    if (row === undefined) {
        return { day, horizonDay, issued: NONE, paid: NONE, unpaid: NONE, expiring: NONE, unmatched: NONE }
    }
    return {
        day,
        horizonDay,
        issued: {
            count: row.issued_count,
            totalVnd: Number(row.issued_total),
            items: row.issued.map((item) => ({
                invoiceNo: item.invoice_no,
                amountVnd: Number(item.amount_vnd),
                customer: item.customer_name ?? "",
            })),
        },
        paid: {
            count: row.paid_count,
            totalVnd: Number(row.paid_total),
            items: row.paid.map((item) => ({
                invoiceNo: item.invoice_no,
                amountVnd: Number(item.amount_vnd),
                customer: item.customer_name ?? "",
                endsOn: item.ends_on,
                extended: item.extended,
            })),
        },
        unpaid: {
            count: row.unpaid_count,
            totalVnd: Number(row.unpaid_total),
            items: row.unpaid.map((item) => ({
                invoiceNo: item.invoice_no,
                amountVnd: Number(item.amount_vnd),
                customer: item.customer_name ?? "",
                dueOn: item.due_on,
            })),
        },
        expiring: {
            count: row.expiring_count,
            totalVnd: Number(row.expiring_total),
            items: row.expiring.map((item) => ({
                customer: item.customer_name,
                plan: item.plan ?? "",
                endsOn: item.ends_on,
            })),
        },
        unmatched: {
            count: row.unmatched_count,
            totalVnd: Number(row.unmatched_total),
            items: row.unmatched.map((item) => ({
                amountVnd: Number(item.amount_vnd ?? 0),
                sender: item.sender_name ?? "",
                memo: item.memo ?? "",
            })),
        },
    }
}

/** The item lines of a tally: the first few, then how many more. */
const itemLines = <Item>(tally: RenewalTally<Item>, parts: (item: Item) => ReadonlyArray<string>): Array<string> => {
    const shown = tally.items.slice(0, RENEWAL_LISTED)
    const more = tally.count - shown.length
    return [...shown.map((item) => RENEWAL_COPY.item(parts(item))), ...(more > 0 ? [RENEWAL_COPY.more(more)] : [])]
}

/** The renewal-to-cash lines in the house bullet format: each part's count and total, then its first items. */
export const renewalLines = (story: RenewalCashStory): ReadonlyArray<string> => {
    const days = Math.round((Date.parse(story.horizonDay) - Date.parse(story.day)) / DAY_MS)
    const money = CARD_COPY.money
    const { issued, paid, unpaid, expiring, unmatched } = story
    return [
        issued.count > 0 ? RENEWAL_COPY.issued(issued.count, money(issued.totalVnd)) : RENEWAL_COPY.issuedNone,
        ...itemLines(issued, (item) => [item.invoiceNo, money(item.amountVnd), item.customer]),
        paid.count > 0 ? RENEWAL_COPY.paid(paid.count, money(paid.totalVnd)) : RENEWAL_COPY.paidNone,
        ...itemLines(paid, (item) => [
            item.invoiceNo,
            money(item.amountVnd),
            item.customer,
            item.extended
                ? RENEWAL_COPY.extended(dayText(item.endsOn))
                : RENEWAL_COPY.notExtended(dayText(item.endsOn)),
        ]),
        unpaid.count > 0
            ? RENEWAL_COPY.unpaid(unpaid.count, money(unpaid.totalVnd), days)
            : RENEWAL_COPY.unpaidNone(days),
        ...itemLines(unpaid, (item) => [
            item.invoiceNo,
            money(item.amountVnd),
            item.customer,
            item.dueOn < story.day
                ? RENEWAL_COPY.overdueSince(dayText(item.dueOn))
                : RENEWAL_COPY.dueOn(dayText(item.dueOn)),
        ]),
        expiring.count > 0 ? RENEWAL_COPY.expiring(expiring.count, days) : RENEWAL_COPY.expiringNone(days),
        ...itemLines(expiring, (item) => [item.customer, item.plan, RENEWAL_COPY.endsOn(dayText(item.endsOn))]),
        unmatched.count > 0
            ? RENEWAL_COPY.unmatched(unmatched.count, money(unmatched.totalVnd))
            : RENEWAL_COPY.unmatchedNone,
        ...itemLines(unmatched, (item) => [
            money(item.amountVnd),
            item.memo === "" ? "" : RENEWAL_COPY.memo(item.memo),
            item.sender === "" ? "" : RENEWAL_COPY.from(item.sender),
        ]),
    ]
}

/** The renewal story with its report lines. */
export const renewalReport = (story: RenewalCashStory): RenewalCashReport => ({ story, lines: renewalLines(story) })

/** The renewal section of an owner report as text: its heading, then its lines. */
export const renewalSectionOf = (report: RenewalCashReport): string =>
    [RENEWAL_COPY.heading, ...report.lines].join("\n")

/** The renewal tiles of the morning card: one count-and-total field per part of the story. */
const renewalFields = (story: RenewalCashStory): ReadonlyArray<HubCardField> => {
    const tile = (tally: RenewalTally<unknown>): string =>
        RENEWAL_COPY.tally(tally.count, CARD_COPY.money(tally.totalVnd))
    return [
        { label: RENEWAL_COPY.fieldIssued, value: tile(story.issued) },
        { label: RENEWAL_COPY.fieldPaid, value: tile(story.paid) },
        { label: RENEWAL_COPY.fieldUnpaid, value: tile(story.unpaid) },
        { label: RENEWAL_COPY.fieldExpiring, value: String(story.expiring.count) },
        { label: RENEWAL_COPY.fieldUnmatched, value: tile(story.unmatched) },
    ]
}

/** The morning card with the renewal-to-cash story: its tiles, its lines (as many as the card holds) and the full text. */
export const withRenewal = (card: DailySummaryCard, report: RenewalCashReport): DailySummaryCard => ({
    ...card,
    text: [card.text, RENEWAL_COPY.heading, ...report.lines].join("\n"),
    hub: {
        ...card.hub,
        fields: [...(card.hub.fields ?? []), ...renewalFields(report.story)],
        lines: [...(card.hub.lines ?? []), ...report.lines.map((text) => ({ text: text.trim() }))].slice(0, HUB_LINES),
        data: { ...card.hub.data, renewal: report.story },
    },
})
