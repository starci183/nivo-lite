/** What the owner types in the manual evidence form, after it has been checked. */
export interface ManualEvidenceInput {
    /** Whole dong, greater than zero. */
    readonly amount: number
    /** yyyy-mm-dd, the day the money arrived. */
    readonly date: string
    readonly content: string
    readonly note: string
    readonly payer: string
}

/** Which field of the form a refused input names. */
export type ManualEvidenceField = "input" | "amount" | "date" | "content"

type ManualEvidenceParse =
    | { readonly success: true; readonly data: ManualEvidenceInput }
    | { readonly success: false; readonly field: ManualEvidenceField }

const DATE = /^\d{4}-\d{2}-\d{2}$/u
const CONTENT_MIN = 3
const CONTENT_MAX = 500
const NOTE_MAX = 1000
const PAYER_MAX = 120

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "")

/** Bounds the manual evidence form before anything reads it: a positive amount, a calendar day, a described payment. */
export const manualEvidenceSchema = {
    safeParse: (input: unknown): ManualEvidenceParse => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const amount = typeof input.amount === "number" ? Math.round(input.amount) : Number.NaN
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, field: "amount" }
        const date = textOf(input.date)
        if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T12:00:00+07:00`)))
            return { success: false, field: "date" }
        const content = textOf(input.content)
        if (content.length < CONTENT_MIN || content.length > CONTENT_MAX) return { success: false, field: "content" }
        const note = textOf(input.note)
        const payer = textOf(input.payer)
        if (note.length > NOTE_MAX || payer.length > PAYER_MAX) return { success: false, field: "input" }
        return { success: true, data: { amount, date, content, note, payer } }
    },
}
