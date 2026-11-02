import type { BadgeTone } from "@starci/grammar/common"
/** What one installed agent shows on the catalogue, already in the reader language. */
export type AgentTeamRowData = {
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    /** "role · channel", already joined. */
    readonly description: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "Setup 3/8". */
    readonly progressLabel: string
    readonly confirmed: number
    readonly total: number
    /** "Continue setup" while gates are open, else "Open". */
    readonly actionLabel: string
    readonly href: string
    /** The agent is not known yet: the row is a skeleton. */
    readonly isLoading: boolean
}

/** The invitation command whose own control displays its pending state. */
export type InviteAction = "resend" | "copy" | "revoke"

/** The latest issued invitation link and the local clipboard acknowledgement. */
export interface InviteShown {
    readonly id: string
    readonly email: string
    readonly link: string
    readonly isCopied: boolean
}

/** The row-local link and clipboard acknowledgement. */
export interface InviteLinkView {
    readonly label: string
    readonly value: string
    readonly isCopied: boolean
}

/** Resolved invitation facts shared by its list identity and action detail. */
export interface InviteRowView {
    readonly id: string
    readonly email: string
    readonly expiry: string
    readonly staffNote?: string | undefined
    readonly roleLabel: string
    readonly isExpired: boolean
    readonly isBusy: boolean
    readonly pendingAction: InviteAction | null
    readonly link?: InviteLinkView | undefined
}
