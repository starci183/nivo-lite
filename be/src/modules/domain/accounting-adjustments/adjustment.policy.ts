import { AccountingAdjustmentsError, AccountingAdjustmentsErrorCode } from "./errors/accounting-adjustments.error"
import type { NewAccountingAdjustment, NormalizedAccountingAdjustment } from "./accounting-adjustments.contracts"

/** Normalizes the note and amount and rejects invalid correction requests before persistence. */
export const normalizeAdjustment = (input: NewAccountingAdjustment): NormalizedAccountingAdjustment => {
    const note = input.note.trim().replace(/\s+/gu, " ")
    const correctedAmount =
        input.correctedAmount === null || input.correctedAmount === undefined ? null : Math.round(input.correctedAmount)
    if (
        !["invoice", "transaction"].includes(input.targetType) ||
        !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/iu.test(input.targetId) ||
        note.length < 5 ||
        note.length > 1000 ||
        (correctedAmount !== null && (!Number.isSafeInteger(correctedAmount) || correctedAmount < 0))
    ) {
        throw new AccountingAdjustmentsError({ code: AccountingAdjustmentsErrorCode.Invalid })
    }
    return { ...input, note, correctedAmount }
}
