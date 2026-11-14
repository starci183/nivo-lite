import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import {
    PAYMENT_TOOL_REFUSALS,
    providerRefusalReason,
    type ProviderRefusalReason,
} from "@modules/domain/provider-registry"

export { PAYMENT_TOOL_BUSINESS_REFUSALS } from "@modules/domain/provider-registry"
export { PAYMENT_TOOL_REFUSALS }

/**
 * The expected refusals of the generic payment-instruction tool: an answer to the caller, never a failure of the connector. Every
 * provider's refusal maps onto these (the leaf lists live in the provider registry, so the tool registry states them without this tool).
 *
 * One refusal of the payment-instruction tool.
 */
export type PaymentRefusalReason = (typeof PAYMENT_TOOL_REFUSALS)[number]

/** What each refusal IS (a TOTAL record): `business` is an answer about the request, `infrastructure` is cured by the owner or the engine. */
export const PAYMENT_REFUSAL_CLASS: Readonly<Record<PaymentRefusalReason, RefusalClass>> = {
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    rejected: "business",
    not_found: "business",
    not_available: "infrastructure",
}

const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, PaymentRefusalReason>> = {
    rejected: "rejected",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal the tool throws for an expected case; the gateway turns it into a `tool_error` answer. */
export const paymentRefusal = (reason: PaymentRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: PAYMENT_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** A provider's refusal as the tool's own; any other failure as it is (the runner reads what it proves). */
export const paymentFailureOf = (cause: unknown): unknown => {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : paymentRefusal(REASON_OF_PROVIDER[reason], cause)
}
