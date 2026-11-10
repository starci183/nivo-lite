/** Log events of the agent-instances capability. */
export enum AgentInstancesLogEvent {
    /** A new agent of a role was created. */
    Created = "agent_instances.created",
    /** The graph of the sibling could not be copied (the checks refused it); the new agent keeps its seed graph. */
    GraphCopyRefused = "agent_instances.graph_copy_refused",
    /** A private document of the sibling could not be copied (quota, or the text is not ready). */
    DocumentCopyRefused = "agent_instances.document_copy_refused",
}
