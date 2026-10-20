import type {
    BankCounts,
    DailySummaryCard,
    DailySummaryInput,
    HubCardPayload,
    UpcomingDue,
} from "./accounting-desk.contracts"
import type { GatewayBankCredit } from "./accounting-gateway.port"
import { CARD_COPY, SUMMARY_COPY, kindText } from "./messages/accounting-desk.messages"

/** The data layers the morning card is built from, recorded on the card (owner ruling: every proposal names its sources). */
export const SUMMARY_SOURCES: ReadonlyArray<string> = [
    "mcp:einvoice.list",
    "mcp:sepay.transactions.list",
    "mcp:hakuen.folio.get",
    "brain:tax_profile",
    "nivo:vn-tax-calendar",
]

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
    lines: input.upcoming.slice(0, 5).map((due) => ({ at: due.dueOn, text: CARD_COPY.dueAt(due, kindText(due.kind)) })),
    data: { day: input.day, upcoming: input.upcoming.slice(0, 5), sources: SUMMARY_SOURCES },
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
        text: [headline, SUMMARY_COPY.stats(input), SUMMARY_COPY.bank(input), nextLine].join("\n"),
        hub: summaryHubCard(input, headline),
    }
}

/** The credits of the window already reconciled (plus those a folio just took), and those still waiting for a match. */
export const bankCounts = (credits: ReadonlyArray<GatewayBankCredit>, recorded: number): BankCounts => {
    const matched = credits.filter((credit) => credit.matched).length + recorded
    return { matched, unmatched: credits.length - matched }
}
