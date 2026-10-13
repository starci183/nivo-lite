/** A content theme as edited by a manager. */
export interface ContentPillarDraft {
    /** The saved theme or cadence identifier. */
    readonly id?: string
    /** The theme name. */
    readonly name: string
    /** The short writing guidance. */
    readonly description: string
    /** The desired balance across themes. */
    readonly weight: number
    /** Whether planning uses this theme. */
    readonly active: boolean
}

/** A saved content theme. */
export interface ContentPillar extends ContentPillarDraft {
    /** The saved theme or cadence identifier. */
    readonly id: string
    /** The workspace that owns this configuration. */
    readonly workspaceId: string
    /** The display order. */
    readonly sort: number
}
