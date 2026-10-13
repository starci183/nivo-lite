import type { Locale } from "@modules/platform/i18n"
import type { LeadAction, LeadActionInput, LeadActionResult, LeadActionStatus } from "../lead-actions.contracts"

/** The persisted backend run, independent of Supabase's generated frontend types. */
export interface LeadActionRunRow {
    /** The run id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The member who requested the action. */
    readonly requested_by: string
    /** The supported action. */
    readonly action: LeadAction
    /** The validated action input. */
    readonly input: LeadActionInput
    /** The output language. */
    readonly locale: Locale
    /** The progress. */
    readonly status: LeadActionStatus["status"]
    /** The terminal result. */
    readonly result: LeadActionResult | null
    /** The terminal error code. */
    readonly error_code: string | null
}
