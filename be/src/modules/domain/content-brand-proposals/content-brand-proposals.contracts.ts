/** Where a brand proposal stands. */
export type BrandProposalStatus = "proposed" | "applied" | "rejected"

/** One stored brand proposal; the kit is as stored (validated by the reader). */
export interface BrandProposalRecord {
    /** The proposal. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The agent instance whose setup chat received the file. */
    readonly installationId: string | null
    /** The setup draft the file was attached to. */
    readonly setupSessionId: string | null
    /** The file name. */
    readonly fileName: string
    /** The file size, bytes. */
    readonly fileSize: number
    /** The stored kit JSON. */
    readonly payload: unknown
    /** Where it stands. */
    readonly status: BrandProposalStatus
    /** Who decided it. */
    readonly decidedBy: string | null
    /** When it was read, ISO 8601. */
    readonly createdAt: string
}

/** What storing a proposal takes. */
export interface NewBrandProposal {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent instance. */
    readonly installationId: string | null
    /** The setup draft. */
    readonly setupSessionId: string | null
    /** The file name. */
    readonly fileName: string
    /** The file size, bytes. */
    readonly fileSize: number
    /** The kit JSON text. */
    readonly payload: string
}

/** How a waiting proposal is closed. */
export interface BrandProposalClosing {
    /** Applied or rejected. */
    readonly status: "applied" | "rejected"
    /** The kit as decided, JSON text. */
    readonly payload: string
    /** Who decided. */
    readonly decidedBy: string
}

/** A proposal, or null when none matches. */
export type OptionalBrandProposalRecord = BrandProposalRecord | null
