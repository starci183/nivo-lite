import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import type {
    PaymentOrderRequestParams,
    RequestSelection,
    PaymentOrderRequestStatus,
    PaymentOrderRequestKind,
} from "./payment-order-requests.contracts"
import type { RequestStatusRow } from "./persistence/payment-order-requests.rows"

const REQUEST_KINDS: ReadonlySet<PaymentOrderRequestKind> = new Set([
    "plan",
    "renew",
    "topup",
    "upgrade",
    "credit_pack",
])
const TARGET_PATTERN = /^[a-z0-9_-]{1,40}$/

/** Checks the request operation and bounds its target before either reaches persistence. */
export const targetOf = (params: PaymentOrderRequestParams): string | null => {
    if (!REQUEST_KINDS.has(params.kind)) {
        throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.Invalid })
    }
    if (params.kind === "renew") return null
    if (typeof params.target !== "string" || !TARGET_PATTERN.test(params.target)) {
        throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.Invalid })
    }
    return params.target
}

/** The cycle, usage tier and seats of a plan request, bounded; a request of another kind carries none of them. */
export const selectionOf = (params: PaymentOrderRequestParams): RequestSelection => {
    if (params.kind !== "plan") return { cycle: null, tierCredits: null, seats: null }
    const cycle = params.cycle ?? "monthly"
    const tierCredits = params.tierCredits ?? null
    const seats = params.seats ?? null
    const valid =
        (cycle === "monthly" || cycle === "annual") &&
        (tierCredits === null || (Number.isInteger(tierCredits) && tierCredits > 0)) &&
        (seats === null || (Number.isInteger(seats) && seats >= 1 && seats <= 1000))
    if (!valid) throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.Invalid })
    return { cycle, tierCredits, seats }
}

const REQUEST_STATUSES: Readonly<Record<RequestStatusRow["status"], PaymentOrderRequestStatus["status"]>> = {
    pending: "queued",
    done: "succeeded",
    failed: "failed",
}

/** Presents a request as queued until its worker writes a terminal outcome. */
export const toRequestStatus = (row: RequestStatusRow): PaymentOrderRequestStatus => ({
    id: row.id,
    status: REQUEST_STATUSES[row.status],
    resultId: row.order_id,
    errorCode: row.fault,
})
