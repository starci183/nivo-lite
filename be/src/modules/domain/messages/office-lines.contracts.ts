/** One line of the Office thread. */
export interface OfficeLineInput {
    /** The text. */
    readonly body: string
    /** The customer it is about. */
    readonly lead_id: string | null
    /** The work item it mirrors. */
    readonly work_item_id: string | null
    /** The department whose agent speaks. */
    readonly dept?: string
    /** True for a command mirror, always a system line. */
    readonly command?: boolean
    /** The instance whose agent speaks. */
    readonly installation_id?: string | null
}

/** The agent that speaks for a department in the Office. */
export interface AgentIdentity {
    /** The agent id. */
    readonly id: string
    /** The display name. */
    readonly name: string
}

/** An agent identity, or null when the department has no agent. */
export type OptionalAgentIdentity = AgentIdentity | null

/** An id, or null when there is none. */
export type OptionalInstallationId = string | null

/** Whose thread a call writes to: the workspace; a work context satisfies it structurally. */
export interface MessagesScope {
    /** The workspace. */
    readonly workspaceId: string
}
