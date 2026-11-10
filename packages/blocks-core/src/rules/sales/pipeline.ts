import { numberOf } from "../../rows/cell-format"
import type { TabCounts } from "../../rows/filter-tabs"
import { textOf, valueAt } from "../../slots/paths"
import { LEAD_STAGES } from "./stage"
import type { LeadStage } from "./stage"

/** One card of the pipeline as the board draws it. */
export interface PipelineCard {
    /** The lead id. */
    readonly id: string
    /** The column the card is in: the stage of the lead. */
    readonly column: string
    /** The customer, with the company after a dot when there is one. */
    readonly title: string
    /** What the deal is: the order or quote amount, else what the customer needs. */
    readonly description: string
    /** The line of the stage: where the deal came from, the next step, why it closed. */
    readonly detail: string
    /** The short fact at the end of the card: the day a lost deal was lost. */
    readonly meta: string
}

/** The words a card is made with; each template has one `{count}` where the value goes. */
export interface PipelineWords {
    /** An order amount: "Order {count}". */
    readonly order: string
    /** A quote amount: "Quote {count}". */
    readonly quote: string
    /** The next step: "Next: {count}". */
    readonly next: string
    /** The day the next step is due: "due {count}". */
    readonly due: string
    /** Who looks after the deal: "Owner: {count}". */
    readonly owner: string
    /** Why the deal was lost: "Reason: {count}". */
    readonly reason: string
}

/** How a card draws a number and a date: the viewer's own formats. */
export interface PipelineFormats {
    /** An amount in VND as money. */
    readonly money: (value: number) => string
    /** An ISO date as the day and month. */
    readonly day: (value: string) => string
}

/** The message key of each word a card is made with. */
export const PIPELINE_WORD_KEYS: Readonly<Record<keyof PipelineWords, string>> = {
    order: "pipeline_order",
    quote: "pipeline_quote",
    next: "pipeline_next",
    due: "pipeline_due",
    owner: "pipeline_owner",
    reason: "pipeline_reason",
}

/** The message key of the name of a stage. */
export const stageKeyOf = (stage: LeadStage): string => `stage_${stage}`

const fill = (template: string, value: string): string => template.replaceAll("{count}", value)

/** A channel code as a name: its first letter in capitals. */
export const channelName = (channel: string): string => `${channel.slice(0, 1).toUpperCase()}${channel.slice(1)}`

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const joined = (parts: ReadonlyArray<string>): string => parts.filter((part) => part !== "").join(" \u00b7 ")

const amountLine = (record: unknown, words: PipelineWords, formats: PipelineFormats): string => {
    const order = numberOf(valueAt(record, "orderVnd"))
    if (order !== null) return fill(words.order, formats.money(order))
    const quote = numberOf(valueAt(record, "quoteVnd"))
    return quote === null ? textOf(valueAt(record, "need")) : fill(words.quote, formats.money(quote))
}

const nextLine = (record: unknown, words: PipelineWords, formats: PipelineFormats): string => {
    const step = textOf(valueAt(record, "nextStep"))
    if (step === "") return textOf(valueAt(record, "note"))
    const due = textOf(valueAt(record, "nextDueAt"))
    return joined([fill(words.next, step), due === "" ? "" : fill(words.due, formats.day(due))])
}

/** The line under a card by the stage of the deal. */
const detailOf = (stage: string, record: unknown, words: PipelineWords, formats: PipelineFormats): string => {
    switch (stage) {
        case "new": {
            const raw = textOf(valueAt(record, "owner"))
            // An owner that is only an id says nothing to a person: leave it out until a name stands in its place.
            const owner = ID_PATTERN.test(raw) ? "" : raw
            return joined([
                channelName(textOf(valueAt(record, "channel"))),
                owner === "" ? "" : fill(words.owner, owner),
            ])
        }
        case "qualified":
        case "proposal":
            return nextLine(record, words, formats)
        case "won":
            return textOf(valueAt(record, "note"))
        case "lost": {
            const reason = textOf(valueAt(record, "closedReason"))
            return reason === "" ? "" : fill(words.reason, reason)
        }
        default:
            return ""
    }
}

/** The cards of a leads read's records; a record without an id draws no card. */
export const pipelineCardsOf = (
    records: ReadonlyArray<unknown>,
    words: PipelineWords,
    formats: PipelineFormats,
): ReadonlyArray<PipelineCard> =>
    records.flatMap((record) => {
        const id = textOf(valueAt(record, "id"))
        if (id === "") return []
        const stage = textOf(valueAt(record, "stage"))
        const updated = textOf(valueAt(record, "updatedAt"))
        return [
            {
                id,
                column: stage,
                title: joined([textOf(valueAt(record, "contactName")), textOf(valueAt(record, "company"))]),
                description: amountLine(record, words, formats),
                detail: detailOf(stage, record, words, formats),
                meta: stage === "lost" && updated !== "" ? formats.day(updated) : "",
            },
        ]
    })

/** The stages the pipeline draws as columns, in the order of the pipeline; stages the spec leaves out are not drawn. */
export const pipelineStagesOf = (shown: ReadonlyArray<LeadStage> | undefined): ReadonlyArray<LeadStage> =>
    LEAD_STAGES.filter((stage) => shown === undefined || shown.includes(stage))

/**
 * How many leads a column holds: what the counts read says for the stage, else the cards the column has when every card is known,
 * else nothing (more cards may still load).
 */
export const columnCountOf = (
    counts: TabCounts | null,
    stage: string,
    drawn: number,
    hasMore: boolean,
): number | undefined => counts?.counts[stage] ?? (hasMore ? undefined : drawn)
