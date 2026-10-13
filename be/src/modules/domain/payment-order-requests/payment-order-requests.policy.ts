import { PaymentOrderRequestsError, PaymentOrderRequestsErrorCode } from "./errors/payment-order-requests.error"
import type {
    PaymentOrderRequestParams,
    PaymentOrderRequestStatus,
    PaymentOrderRequestKind,
} from "./payment-order-requests.contracts"
import type { RequestStatusRow } from "./persistence/payment-order-requests.rows"

const REQUEST_KINDS: ReadonlyArray<PaymentOrderRequestKind> = ["plan", "renew", "topup", "upgrade"]
const TARGET_PATTERN = /^[a-z0-9_-]{1,40}$/

/** Checks the request operation and bounds its target before either reaches persistence. */
export const targetOf = (params: PaymentOrderRequestParams): string | null => {
    if (!REQUEST_KINDS.includes(params.kind)) {
        throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.Invalid })
    }
    if (params.kind === "renew") return null
    if (typeof params.target !== "string" || !TARGET_PATTERN.test(params.target)) {
        throw new PaymentOrderRequestsError({ code: PaymentOrderRequestsErrorCode.Invalid })
    }
    return params.target
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
