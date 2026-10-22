import type { Locale } from "@modules/platform/i18n"

/** What the DecideThreadApproval operation takes. */
export interface DecideThreadApprovalRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The message that carries the card. */
    readonly messageId: string
    /** Approve or reject. */
    readonly verdict: "approve" | "reject"
    /** The language of the texts the capability writes. */
    readonly locale: Locale
}
