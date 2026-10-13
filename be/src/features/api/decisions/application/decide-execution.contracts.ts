import type { DecisionVerdict } from "@modules/domain/decisions"
import type { Locale } from "@modules/platform/i18n"

/** What deciding an approval card takes. */
export interface DecideExecutionRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The approval card. */
    readonly executionId: string
    /** Approve or reject. */
    readonly decision: DecisionVerdict
    /** The draft the person edited, when they did. */
    readonly editedDraft?: string
    /** The language of the generated text. */
    readonly locale: Locale
}
