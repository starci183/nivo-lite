import type { Locale } from "@modules/platform/i18n"
import type { CardDecision } from "@modules/domain/modules"

/** What deciding a confirm card of the setup chat takes. */
export interface DecideSetupCardRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The card. */
    readonly cardId: string
    /** The decision with the edits. */
    readonly change: CardDecision
    /** The language of the names and the generated text. */
    readonly locale: Locale
}
