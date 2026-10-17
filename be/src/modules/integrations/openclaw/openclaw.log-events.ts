/** Log events of the OpenClaw integration. */
export enum OpenclawLogEvent {
    /** One turn finished; the marks ride in the fields. */
    TurnTimed = "openclaw.turn_timed",
    /** The gateway is still starting; the connect is retried. */
    ConnectRetry = "openclaw.connect_retry",
    /** A session already existed or could not be created; the send shows the real reason. */
    SessionCreateSkipped = "openclaw.session_create_skipped",
    /** The gateway sent text that is not a frame; it is ignored. */
    FrameRejected = "openclaw.frame_rejected",
    /** An agent entry was written into openclaw.json. */
    AgentRegistered = "openclaw.agent_registered",
    /** openclaw.json could not be read as JSON. */
    ConfigUnreadable = "openclaw.config_unreadable",
    /** The managed-file manifest of a workspace could not be read as JSON; it is treated as empty. */
    ManifestUnreadable = "openclaw.manifest_unreadable",
    /** A tool token carried a body that is not JSON claims. */
    ToolGrantUnreadable = "openclaw.tool_token_unreadable",
}
