/** A correction note beside an invoice or a payment, after it has been checked. The original row is never edited. */
export interface AdjustmentInput {
    readonly targetType: "invoice" | "transaction"
    readonly targetId: string
    readonly note: string
    /** Whole dong, zero or more; null when the note does not correct the amount. */
    readonly correctedAmount: number | null
}

/** Which field of the form a refused input names. */
export type AdjustmentField = "input" | "target" | "note" | "amount"

type AdjustmentParse =
    | { readonly success: true; readonly data: AdjustmentInput }
    | { readonly success: false; readonly field: AdjustmentField }

const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/u
const NOTE_MIN = 5
const NOTE_MAX = 1000

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/** Bounds the correction form before anything reads it: a known target, a note of substance, an amount of zero or more. */
export const adjustmentSchema = {
    safeParse: (input: unknown): AdjustmentParse => {
        if (!isRecord(input)) return { success: false, field: "input" }
        const targetType =
            input.targetType === "invoice" || input.targetType === "transaction" ? input.targetType : null
        if (targetType === null || typeof input.targetId !== "string" || !UUID.test(input.targetId)) {
            return { success: false, field: "target" }
        }
        const note = typeof input.note === "string" ? input.note.trim().replace(/\s+/gu, " ") : ""
        if (note.length < NOTE_MIN || note.length > NOTE_MAX) return { success: false, field: "note" }
        if (input.correctedAmount === null || input.correctedAmount === undefined) {
            return { success: true, data: { targetType, targetId: input.targetId, note, correctedAmount: null } }
        }
        const corrected = typeof input.correctedAmount === "number" ? Math.round(input.correctedAmount) : Number.NaN
        if (!Number.isFinite(corrected) || corrected < 0) return { success: false, field: "amount" }
        return { success: true, data: { targetType, targetId: input.targetId, note, correctedAmount: corrected } }
    },
}
