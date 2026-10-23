/** What assign agent work takes. */
export interface AssignAgentWorkRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves their membership. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** What to do, as the person wrote it. */
    readonly text: string
    /** The action the agent starts on, or absent. */
    readonly action?: string | null
    /** The amount in the unit of the action's rule, or absent. */
    readonly amount?: number | null
    /** The value of the deal, VND, or absent. */
    readonly amountVnd?: number | null
    /** The customer the work is about, or absent. */
    readonly leadId?: string | null
}
