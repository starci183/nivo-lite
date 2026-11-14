import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import {
    INVOICE_TOOL_BUSINESS_REFUSALS,
    INVOICE_TOOL_REFUSALS,
    providerRefusalReason,
    type InvoiceToolRefusal,
    type ProviderRefusalReason,
} from "@modules/domain/provider-registry"

export { INVOICE_TOOL_BUSINESS_REFUSALS, INVOICE_TOOL_REFUSALS }
export type { InvoiceToolRefusal }

/**
 * What each refusal IS (a TOTAL record): `business`, an answer about the invoice a node reads and branches on (`rejected`, `not_found`);
 * `infrastructure`, cured only by the setup (the account, its credential, the adapter): the step freezes.
 */
export const INVOICE_REFUSAL_CLASS: Readonly<Record<InvoiceToolRefusal, RefusalClass>> = {
    rejected: "business",
    not_found: "business",
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    not_available: "infrastructure",
}

const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, InvoiceToolRefusal>> = {
    rejected: "rejected",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal the tool throws; the gateway turns it into a `tool_error` answer. The failure that led to it rides as its cause. */
export const invoiceRefusal = (reason: InvoiceToolRefusal, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: INVOICE_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/**
 * A provider's refusal as the tool's own; any other failure as it is: a failure that proves `not_sent` (the provider was unavailable,
 * nothing issued) moves the call on to the node's next bound account and then stops the step (a transient failure: the engine's bounded
 * retry when it lands, R73); one that proves `unknown` (the invoice may exist) stops the step for a person at once and is never sent again
 * by itself (the tool is not repeatable, R74).
 */
export const invoiceFailureOf = (cause: unknown): unknown => {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : invoiceRefusal(REASON_OF_PROVIDER[reason], cause)
}
