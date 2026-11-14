import { ToolsError, ToolsErrorCode, type RefusalClass } from "@modules/domain/tools"
import { providerRefusalReason, type ProviderRefusalReason } from "@modules/domain/provider-registry"

/**
 * Every refusal a generic calendar tool answers, whichever provider served it: `not_connected` (no account handed, or no credential or
 * consent), `connection_refused` (the provider refused the credential), `rejected` (it refused the request and did nothing: an invalid
 * window, a duplicate event id), `not_found` (the calendar or event is not there), `not_available` (an operation not built).
 */
export const CALENDAR_REFUSALS = ["not_connected", "connection_refused", "rejected", "not_found", "not_available"] as const

/** One refusal of a calendar tool. */
export type CalendarRefusalReason = (typeof CALENDAR_REFUSALS)[number]

/** What each refusal IS (a TOTAL record): `business` is an answer a node reads and goes on from; `infrastructure` freezes the step. */
export const CALENDAR_REFUSAL_CLASS: Readonly<Record<CalendarRefusalReason, RefusalClass>> = {
    not_connected: "infrastructure",
    connection_refused: "infrastructure",
    rejected: "business",
    not_found: "business",
    not_available: "infrastructure",
}

/** The business refusals the tool registry lists for a calendar tool. */
export const CALENDAR_BUSINESS_REFUSALS: readonly ["rejected", "not_found"] = ["rejected", "not_found"] as const satisfies ReadonlyArray<CalendarRefusalReason>

const REASON_OF_PROVIDER: Readonly<Record<ProviderRefusalReason, CalendarRefusalReason>> = {
    rejected: "rejected",
    not_found: "not_found",
    auth_refused: "connection_refused",
    no_credential: "not_connected",
    not_available: "not_available",
}

/** The refusal a calendar tool throws for an expected case; the gateway turns it into a `tool_error` answer. */
export const calendarRefusal = (reason: CalendarRefusalReason, cause?: unknown): ToolsError =>
    new ToolsError({
        code: ToolsErrorCode.NativeRefused,
        params: { reason, refusalClass: CALENDAR_REFUSAL_CLASS[reason] },
        ...(cause === undefined ? {} : { cause }),
    })

/** A provider's refusal as the tool's own; any other failure as it is (the step's freeze reads what it proves). */
export const calendarFailureOf = (cause: unknown): unknown => {
    const reason = providerRefusalReason(cause)
    return reason === null ? cause : calendarRefusal(REASON_OF_PROVIDER[reason], cause)
}
