/** What the ProbeAgentSearch operation takes. */
export interface ProbeAgentSearchRequest {
    /** The workspace the caller names in X-Workspace-Id; the service proves the caller is its owner. */
    readonly workspaceId: string
    /** The agent the tool is run as. */
    readonly agentId: string
    /** The Brain read tool, by its id. */
    readonly tool: string
    /** The arguments as the model would write them: the text of one JSON object. */
    readonly arguments: string
    /** A customer conversation the call would serve (the lens then narrows to the public), or absent. */
    readonly conversationId?: string | null | undefined
}
