/** Log events of the agent-instances capability. */
export enum AgentInstancesLogEvent {
    /** A new agent of a role was created. */
    Created = "agent_instances.created",
    /** The graph of the sibling could not be copied (the checks refused it); the new agent keeps its seed graph. */
    GraphCopyRefused = "agent_instances.graph_copy_refused",
    /** A private document of the sibling could not be copied (quota, or the text is not ready). */
    DocumentCopyRefused = "agent_instances.document_copy_refused",
    /** A creation failed after its installation was made; the installation was removed again. */
    CreationUndone = "agent_instances.creation_undone",
    /** A creation failed and its installation could not be removed again: a half-made agent is left, named by its installation. */
    CreationUndoFailed = "agent_instances.creation_undo_failed",
    /** A customer channel was connected and the agent that answers it was installed for it. */
    FrontDoorInstalled = "agent_instances.front_door_installed",
    /** A customer channel was connected and the workspace's existing front door was attached to it. */
    FrontDoorAttached = "agent_instances.front_door_attached",
    /** A customer channel was connected and no installed template declares a front door for it: nobody answers it. */
    FrontDoorMissing = "agent_instances.front_door_missing",
    /** A customer channel was connected, its front door could not be installed, and the connection was marked in error. */
    FrontDoorFailed = "agent_instances.front_door_failed",
}
