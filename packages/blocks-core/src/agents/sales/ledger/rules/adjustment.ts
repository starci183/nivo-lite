import type { AdjustmentTarget } from "./accounting.types"

/** The shortest note a correction carries, once trimmed. */
export const ADJUSTMENT_NOTE_MIN = 5

/** The longest note a correction carries. */
export const ADJUSTMENT_NOTE_MAX = 1000

/** What a correction request holds before it is judged. */
export interface AdjustmentRequest {
    /** The kind of record corrected. */
    readonly targetType: AdjustmentTarget
    /** The record corrected. */
    readonly targetId: string
    /** The accountant's note. */
    readonly note: string
    /** The amount the record should have had, or nothing. */
    readonly correctedAmount?: number | null | undefined
}

/** A correction that may be written: the note tidied, the amount rounded to a whole dong. */
export interface NormalizedAdjustment {
    /** The kind of record corrected. */
    readonly targetType: AdjustmentTarget
    /** The record corrected. */
    readonly targetId: string
    /** The note, trimmed, its white space collapsed. */
    readonly note: string
    /** The corrected amount in whole VND, or null. */
    readonly correctedAmountVnd: number | null
}

/** Why a correction was refused: a note of the wrong length, or an amount that is no whole non-negative number. */
export type AdjustmentRefusal = "note_length" | "amount_invalid"

/** The verdict on a correction request: the normalized correction, or the reason it is refused. */
export type AdjustmentVerdict =
    | { readonly ok: true; readonly adjustment: NormalizedAdjustment }
    | { readonly ok: false; readonly reason: AdjustmentRefusal }

/** Normalizes the note and the amount of a correction and refuses an invalid one before it reaches storage. */
export const normalizeAdjustment = (request: AdjustmentRequest): AdjustmentVerdict => {
    const note = request.note.trim().replaceAll(/\s+/gu, " ")
    const correctedAmountVnd =
        request.correctedAmount === null || request.correctedAmount === undefined
            ? null
            : Math.round(request.correctedAmount)
    if (note.length < ADJUSTMENT_NOTE_MIN || note.length > ADJUSTMENT_NOTE_MAX)
        return { ok: false, reason: "note_length" }
    if (correctedAmountVnd !== null && (!Number.isSafeInteger(correctedAmountVnd) || correctedAmountVnd < 0))
        return { ok: false, reason: "amount_invalid" }
    return {
        ok: true,
        adjustment: { targetType: request.targetType, targetId: request.targetId, note, correctedAmountVnd },
    }
}
