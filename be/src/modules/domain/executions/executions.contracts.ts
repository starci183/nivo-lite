/** What an approval card is made of. */
export interface NewExecution {
    /** The workspace. */
    readonly workspaceId: string
    /** The responsibility the draft belongs to. */
    readonly responsibilityId: string
    /** The agent that wrote the draft, when there is one. */
    readonly agentId: string | null
    /** The text the person approves. */
    readonly draft: string
    /** The work item it belongs to. */
    readonly workItemId: string
}
