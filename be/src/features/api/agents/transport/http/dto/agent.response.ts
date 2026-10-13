/** An agent as the instance list shows it. */
export class AgentSummaryResponse {
    /** The agent. */
    id!: string
    /** The module the agent belongs to. */
    module!: string
    /** The display name. */
    name!: string
    /** The @handle, unique in the workspace. */
    handle!: string
    /** The one-line role. */
    role!: string
    /** `active` or `paused`. */
    status!: string
    /** When the agent was created, ISO 8601. */
    createdAt!: string
}
