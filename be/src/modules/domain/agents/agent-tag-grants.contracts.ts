/** One right to pass work: the agent that may tag, and the agent it may tag. */
export interface TagGrant {
    /** The agent that gains the right to pass work. */
    readonly from: string
    /** The agent it may pass work to. */
    readonly to: string
}

/** The tag rights to grant in one workspace. */
export type TagGrants = ReadonlyArray<TagGrant>
