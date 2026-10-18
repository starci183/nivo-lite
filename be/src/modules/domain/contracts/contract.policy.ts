import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { CONTRACT_STATUSES } from "./contracts.contracts"
import { ContractsErrorCode } from "./errors/contracts.error"

/** What a contract form submits before it is judged. */
export interface ContractDraft {
    /** The customer name. */
    readonly customerName: string
    /** The plan the customer buys. */
    readonly plan: string
    /** The first day, YYYY-MM-DD. */
    readonly startsOn: string
    /** The last day, YYYY-MM-DD. */
    readonly endsOn: string
    /** The recurring amount in whole dong; null when not agreed. */
    readonly amountVnd: number | null
    /** The status the person chose. */
    readonly status: string
    /** A free note. */
    readonly note: string
}

const CUSTOMER_MAX = 120
const PLAN_MAX = 120
const NOTE_MAX = 500

/** True for a real calendar day written YYYY-MM-DD. */
export const isIsoDay = (value: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

const isKnownStatus = (status: string): boolean => {
    const statuses: ReadonlyArray<string> = CONTRACT_STATUSES
    return statuses.includes(status)
}

/** Judges what a contract form submits and answers it trimmed and bounded with real days, or the first reason it is refused. */
export const checkContract = (draft: ContractDraft): Outcome<ContractDraft, ContractsErrorCode> => {
    const customerName = draft.customerName.trim().slice(0, CUSTOMER_MAX)
    if (customerName === "") return refused(ContractsErrorCode.CustomerRequired)
    const startsOn = draft.startsOn.trim()
    const endsOn = draft.endsOn.trim()
    if (!isIsoDay(startsOn) || !isIsoDay(endsOn)) return refused(ContractsErrorCode.DateInvalid)
    if (endsOn < startsOn) return refused(ContractsErrorCode.DatesReversed)
    if (!isKnownStatus(draft.status)) {
        return refused(ContractsErrorCode.StatusInvalid, { list: CONTRACT_STATUSES.join(", ") })
    }
    if (draft.amountVnd !== null && (!Number.isFinite(draft.amountVnd) || draft.amountVnd < 0)) {
        return refused(ContractsErrorCode.AmountInvalid)
    }
    return ok({
        customerName,
        plan: draft.plan.trim().slice(0, PLAN_MAX),
        startsOn,
        endsOn,
        amountVnd: draft.amountVnd,
        status: draft.status,
        note: draft.note.trim().slice(0, NOTE_MAX),
    })
}
