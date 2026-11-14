import { z } from "zod"
import { MAX_ENTRIES, MAX_ID, MAX_LINE } from "../../../../shared/bounds"
import type { LineageKind, LineageStep } from "./lineage"
import { SALES_INVOICE_ENTITY, SALES_TRANSACTION_ENTITY } from "../../../../shared/entities/sales-entity-names"


/** The entry the detail shows, as the entry read answers it: what it is called, where it comes from and the steps of that source. */
export interface EntryRecord {
    /** The entry id. */
    readonly id: string
    /** A short note that names the entry; absent or null names it by its id. */
    readonly note?: string | null | undefined
    /** The entity of the row the entry comes from. */
    readonly sourceEntity: string
    /** The row the entry comes from. */
    readonly sourceId: string
    /** The source steps in the order the money moved. */
    readonly lineage: ReadonlyArray<LineageStep>
    /** The amount of the entry, in VND, when the read gives it. */
    readonly amountVnd?: number | undefined
    /** Whether the entry's payment may be written to the ledger again; absent offers nothing. */
    readonly canRepostLedger?: boolean | undefined
}

const lineageKind = z.enum(["order", "invoice", "payment", "adjustment"])

const lineageStep: z.ZodType<LineageStep> = z.object({
    id: z.string().max(MAX_ID),
    kind: lineageKind,
    title: z.string().max(MAX_LINE),
    detail: z.string().max(MAX_LINE).nullable(),
    at: z.string().max(MAX_ID).nullable(),
    status: z.string().max(MAX_ID).nullable(),
    amount: z.number().nullable(),
})

/** The entry of the detail, judged by the fields the detail draws; a record that does not fit is a failed read. */
export const entryRecord: z.ZodType<EntryRecord> = z.looseObject({
    id: z.string().min(1).max(MAX_ID),
    note: z.string().max(MAX_LINE).nullable().optional(),
    sourceEntity: z.string().max(MAX_ID),
    sourceId: z.string().max(MAX_ID),
    lineage: z.array(lineageStep).max(MAX_ENTRIES),
    amountVnd: z.number().optional(),
    canRepostLedger: z.boolean().optional(),
})

/** The head of the detail: the note of the entry, or its id when it has none. */
export const entryTitleOf = (entry: EntryRecord): string =>
    entry.note === undefined || entry.note === null || entry.note === "" ? entry.id : entry.note

/** The stages every payment passes on its way into the books, in the order the money moves. */
export const STAGE_KINDS: ReadonlyArray<Exclude<LineageKind, "adjustment">> = ["order", "invoice", "payment"]

/** One stage of where an entry came from: done when the record exists, waiting when it does not yet. */
export interface EntryStage {
    /** The key the timeline draws the stage under. */
    readonly id: string
    /** Whether the record behind the stage exists. */
    readonly isDone: boolean
    /** The stage name and the number of its record. */
    readonly title: string
    /** What stands in the record (its state, its day, who or what made it), or that it is missing. */
    readonly note: string
}

/** The words the stages are written with, already in the viewer's language. */
export interface StageWords {
    /** The name of each stage. */
    readonly names: Readonly<Record<LineageKind, string>>
    /** The note of a stage whose record does not exist. */
    readonly missing: string
    /** The words of the state of a record, or undefined when the state has none. */
    readonly state: (kind: LineageKind, status: string) => string | undefined
}

/** The day of an instant written day then month; empty for no instant. */
const stepDay = (at: string | null): string => {
    const day = /^\d{4}-(\d{2})-(\d{2})/.exec(at ?? "")
    return day === null ? "" : `${day[2]}/${day[1]}`
}

const noteOf = (step: LineageStep, words: StageWords): string =>
    [step.status === null ? "" : (words.state(step.kind, step.status) ?? ""), stepDay(step.at), step.detail ?? ""]
        .filter((part) => part !== "")
        .join(" \u00b7 ")

const titleOf = (step: LineageStep, words: StageWords): string =>
    step.kind === "payment" ? words.names.payment : `${words.names[step.kind]} ${step.title}`

/**
 * The stages an entry came from: the order, the invoice and the payment, each done when the entry's lineage holds a record of that
 * kind and waiting otherwise, then the corrections that point at it.
 */
export const stagesOf = (lineage: ReadonlyArray<LineageStep>, words: StageWords): ReadonlyArray<EntryStage> => [
    ...STAGE_KINDS.map((kind): EntryStage => {
        const step = lineage.find((candidate) => candidate.kind === kind)
        return step === undefined
            ? { id: kind, isDone: false, title: words.names[kind], note: words.missing }
            : { id: step.id, isDone: true, title: titleOf(step, words), note: noteOf(step, words) }
    }),
    ...lineage
        .filter((step) => step.kind === "adjustment")
        .map((step): EntryStage => ({
            id: step.id,
            isDone: true,
            title: words.names.adjustment,
            note: noteOf(step, words),
        })),
]

/** Where an entry comes from: the entity and the id of its source row. */
export interface EntrySource {
    /** The entity of the row the entry comes from. */
    readonly sourceEntity: string
    /** The row the entry comes from. */
    readonly sourceId: string
}

/** What an adjustment is made on: the kind of record and its id. */
export interface AdjustTarget {
    /** `invoice` or `transaction`: the records a correction can point at. */
    readonly targetType: "invoice" | "transaction"
    /** The id of the record. */
    readonly targetId: string
}

/** The record a correction of an entry points at: the invoice or the payment it comes from; none for an entry that is itself a correction. */
export const adjustTargetOf = (entry: EntrySource): AdjustTarget | null => {
    if (entry.sourceEntity === SALES_INVOICE_ENTITY) return { targetType: "invoice", targetId: entry.sourceId }
    if (entry.sourceEntity === SALES_TRANSACTION_ENTITY) return { targetType: "transaction", targetId: entry.sourceId }
    return null
}

/** The states a record of each kind can stand in, which the stages have words for. */
const KNOWN_STATES: Readonly<Record<LineageKind, ReadonlyArray<string>>> = {
    order: ["draft", "confirmed", "invoiced", "paid", "cancelled"],
    invoice: ["draft", "issued", "paid", "void"],
    payment: ["unmatched", "matched", "needs_review", "other_income"],
    adjustment: [],
}

/** The message key of the words of a state (`state_invoice_issued`), or undefined for a state the stages have no words for. */
export const stateKeyOf = (kind: LineageKind, status: string): string | undefined =>
    KNOWN_STATES[kind].includes(status) ? `state_${kind}_${status}` : undefined
