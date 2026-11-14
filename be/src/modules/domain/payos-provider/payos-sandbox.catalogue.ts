import { PROVIDER } from "@nivo-lite/agent-sdk/names"
import type { SandboxCatalogue, SandboxInboundCase, SandboxInput } from "@modules/domain/provider-sandbox"

/** The provider key the payOS sandbox answers for. */
export const PAYOS_SANDBOX_PROVIDER: typeof PROVIDER.payos = PROVIDER.payos

/** The operations (port methods) the cases answer. */
export const PAYOS_SANDBOX_OPERATION = { create: "create", get: "get", cancel: "cancel" } as const

/** The ids of the outbound cases the implementation answers (it reads `state.nextCase` against them; PAYOS-1, PAYOS-4 and PAYOS-5 are the defaults). */
export const PAYOS_SANDBOX_CASE = {
    /** PAYOS-1 (default of `create`): a PENDING link is created. */
    created: "PAYOS-1",
    /** PAYOS-2: payOS refuses the create (order already exists). */
    createRefused: "PAYOS-2",
    /** PAYOS-4 (default of `get`): the account's kept link is read. */
    read: "PAYOS-4",
    /** PAYOS-5 (default of `cancel`): a PENDING link is cancelled. */
    cancelled: "PAYOS-5",
    /** PAYOS-6: payOS answers that the link is not found, whatever the reference. */
    readNotFound: "PAYOS-6",
    /** PAYOS-7: payOS refuses to cancel (the link is not pending), whatever its state. */
    cancelRefused: "PAYOS-7",
} as const

/** The words payOS refuses with for a duplicate order code (its documentation names the refusal "order already exists"). */
export const PAYOS_SANDBOX_REFUSED_REASON = "order already exists"

/** Why the sandbox cancels a link that is no longer pending: the refusal's words. */
export const PAYOS_SANDBOX_CANNOT_CANCEL_REASON = "link is not pending"

/** The order code of the first link a sandbox account creates (the next ones count up from it): the paid webhook below names it. */
export const PAYOS_SANDBOX_FIRST_ORDER_CODE = 1_780_000_000_001

/** The id of the n-th link of an account (n counts from 1). */
export const payosSandboxLinkId = (n: number): string => `sbx-payos-link-${String(n).padStart(6, "0")}`

/** The address of the hosted payment page of a link id. */
export const payosSandboxCheckoutUrl = (linkId: string): string => `https://pay.payos.vn/web/${linkId}`

/** The raw QR payload every sandbox link carries (fixed). */
export const PAYOS_SANDBOX_QR_PAYLOAD = "00020101021238570010A000000727sandbox"

/** The fixed instant every sandbox link is created and cancelled at (the sandbox never reads the clock). */
export const PAYOS_SANDBOX_AT = "2026-11-14T10:00:00+07:00"

/** The state name the links an account created are kept under, by link id (the payment-link sandbox writes it, the paid case reads it). */
const LINK_STATE = "link"

/** The state name the link id of an order code is kept under, by the code's text. */
const ORDER_STATE = "order"

/** The state name the description (the transfer content) a link was created with is kept under, by link id: what the paid webhook then carries. */
export const PAYOS_SANDBOX_DESCRIPTION_STATE = "description"

/** The transfer content the paid webhook names when the account holds no link of the order code. */
const PAYOS_SANDBOX_DEFAULT_DESCRIPTION = "DH001"

/** payOS's booking time text (Vietnam time, UTC+7, no zone) of an instant. */
export const payosTimeOf = (at: Date): string => new Date(at.getTime() + 7 * 3_600_000).toISOString().slice(0, 19).replace("T", " ")

/** The amount the paid webhook names when the account holds no link of the order code. */
const PAYOS_SANDBOX_DEFAULT_AMOUNT = 150000

/**
 * The body payOS posts to NIVO when a sandbox link is paid: its real shape (`code`, `desc`, `success`, `data` with the paid order,
 * `signature`). The signature is a fixed placeholder: the sandbox route is proven by the account's sandbox key, never by a checksum key
 * (the sandbox holds none).
 */
const paidBodyOf = (paid: {
    readonly orderCode: number
    readonly linkId: string
    readonly amount: number
    readonly description: string
    readonly seq: number
    readonly at: Date
}) =>
    ({
        code: "00",
        desc: "success",
        success: true,
        data: {
            orderCode: paid.orderCode,
            amount: paid.amount,
            description: paid.description,
            accountNumber: "12345678",
            reference: `SBXPAYOS${String(paid.seq + 1).padStart(6, "0")}`,
            transactionDateTime: payosTimeOf(paid.at),
            currency: "VND",
            paymentLinkId: paid.linkId,
            code: "00",
            desc: "Thành công",
            counterAccountBankId: "",
            counterAccountBankName: "",
            counterAccountName: "",
            counterAccountNumber: "",
            virtualAccountName: "",
            virtualAccountNumber: "",
        },
        signature: "sandbox-placeholder",
    }) as const

/**
 * The paid-order webhook of a link the account created (its order code is the one input, payOS's own word): the link id, the amount and
 * the description (the transfer content) are read back from the account's state when the account holds the link, else the id counts from
 * the first order code and the amount and description are fixed. The bank reference runs per account from `state.seq` (each paid order
 * is its own transaction, never a duplicate of the last) and the booking time is the send's moment.
 */
const paidCase: SandboxInboundCase = {
    trigger: "transaction.received",
    path: (connectionId) => `api/connections/payos/${connectionId}`,
    inputs: [{ name: "orderCode", label: "Mã đơn payOS / payOS order code", kind: "integer", example: PAYOS_SANDBOX_FIRST_ORDER_CODE }],
    eventsOf: async (input: SandboxInput, context) => {
        const orderCode = typeof input.orderCode === "number" ? input.orderCode : PAYOS_SANDBOX_FIRST_ORDER_CODE
        const keptLinkId = await context.state.read(ORDER_STATE, String(orderCode))
        const linkId = typeof keptLinkId === "string" ? keptLinkId : payosSandboxLinkId(orderCode - PAYOS_SANDBOX_FIRST_ORDER_CODE + 1)
        const kept = await context.state.read(LINK_STATE, linkId)
        const keptAmount: unknown = typeof kept === "object" && kept !== null ? Reflect.get(kept, "amountVnd") : undefined
        const keptDescription = await context.state.read(PAYOS_SANDBOX_DESCRIPTION_STATE, linkId)
        return [
            {
                body: paidBodyOf({
                    orderCode,
                    linkId,
                    amount: typeof keptAmount === "number" ? keptAmount : PAYOS_SANDBOX_DEFAULT_AMOUNT,
                    description: typeof keptDescription === "string" ? keptDescription : PAYOS_SANDBOX_DEFAULT_DESCRIPTION,
                    seq: context.state.seq,
                    at: context.at,
                }),
            },
        ]
    },
}

/**
 * The hardcoded cases of payOS's sandbox (R62), for the payment-link port. OUTBOUND: the account's sticky NEXT CASE picks one per
 * operation and the default (success) case answers while nothing is picked: `create` PAYOS-1 (default, a PENDING link) or PAYOS-2
 * (refused), `get` PAYOS-4 (default, the kept link) or PAYOS-6 (not found), `cancel` PAYOS-5 (default, a PENDING link becomes
 * CANCELLED) or PAYOS-7 (refused, not pending). The request never picks a case; a link never created is still not found and a link
 * already cancelled is still refused a second cancel (the answer reads the state). INBOUND: PAYOS-3, the link is paid (payOS's webhook on
 * its real route, built from the order code). Link ids and order codes come from state, counting up per create.
 */
export const PAYOS_SANDBOX_CATALOGUE: SandboxCatalogue = {
    provider: PAYOS_SANDBOX_PROVIDER,
    cases: [
        {
            id: PAYOS_SANDBOX_CASE.created,
            label: "A payment link is created: a PENDING link, its id and order code counting up from the account's state",
            operation: PAYOS_SANDBOX_OPERATION.create,
            default: true,
        },
        {
            id: PAYOS_SANDBOX_CASE.createRefused,
            label: `A create is refused: payOS rejects it ("${PAYOS_SANDBOX_REFUSED_REASON}"), no link, no proof attached as live`,
            operation: PAYOS_SANDBOX_OPERATION.create,
        },
        {
            id: "PAYOS-3",
            label: "A link is paid: payOS posts the paid-order webhook (code 00) of the order code named (by default the account's first link) to NIVO's payOS route",
            inbound: paidCase,
        },
        {
            id: PAYOS_SANDBOX_CASE.read,
            label: "A link is read by its link id or its order code: the account's kept link, or the not-found refusal for one it never created",
            operation: PAYOS_SANDBOX_OPERATION.get,
            default: true,
        },
        {
            id: PAYOS_SANDBOX_CASE.cancelled,
            label: `A link is cancelled: a PENDING link becomes CANCELLED with the reason; a link that is not pending is rejected ("${PAYOS_SANDBOX_CANNOT_CANCEL_REASON}"); an unknown one is not found`,
            operation: PAYOS_SANDBOX_OPERATION.cancel,
            default: true,
        },
        {
            id: PAYOS_SANDBOX_CASE.readNotFound,
            label: "A link is not found: payOS answers not found to the read, whatever the reference",
            operation: PAYOS_SANDBOX_OPERATION.get,
        },
        {
            id: PAYOS_SANDBOX_CASE.cancelRefused,
            label: `A cancel is refused: payOS rejects it ("${PAYOS_SANDBOX_CANNOT_CANCEL_REASON}"), the link stays as it was`,
            operation: PAYOS_SANDBOX_OPERATION.cancel,
        },
    ],
}
