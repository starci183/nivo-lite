/** Who an agent's view of the knowledge is for: the public view of a customer, or the team's view. */
export type KnowledgeAudience = "customer" | "internal"

/** What one agent may read of the business knowledge: the workspace, its module and instance, and the audience. */
export interface KnowledgeView {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the agent. */
    readonly module: string
    /** customer sees public knowledge only; internal sees public and internal. */
    readonly audience: KnowledgeAudience
    /** The agent instance, or null for the knowledge shared by every instance only. */
    readonly installationId: string | null
}

/** What a caller asks a view to be made from; the audience can only narrow what the module may see. */
export interface ViewRequest {
    /** The workspace. */
    readonly workspaceId: string
    /** The module of the agent. */
    readonly module: string
    /** A narrower audience: a text that leaves the business is written from the public view. */
    readonly audience?: KnowledgeAudience
    /** The agent instance. */
    readonly installationId?: string | null
}

/** What a task the system runs for an agent asks of the business notes: the lane of the agent and a question. */
export interface AgentNotesRequest extends KnowledgeView {
    /** What the notes are looked up for. */
    readonly question: string
    /** The most passages wanted. */
    readonly limit: number
}
