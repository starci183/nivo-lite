/** Log events of the OpenClaw integration. */
export enum OpenclawLogEvent {
    /** One turn finished; the marks ride in the fields. */
    TurnTimed = "openclaw.turn_timed",
    /** The gateway is still starting; the connect is retried. */
    ConnectRetry = "openclaw.connect_retry",
    /** A session already existed or could not be created; the send shows the real reason. */
    SessionCreateSkipped = "openclaw.session_create_skipped",
    /** An agent entry was written into openclaw.json. */
    AgentRegistered = "openclaw.agent_registered",
}
