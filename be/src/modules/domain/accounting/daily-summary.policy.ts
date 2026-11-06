import type {
    BankCounts,
    DailySummaryCard,
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
import { CARD_COPY, SUMMARY_COPY, kindText } from "./messages/accounting-desk.messages"

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
