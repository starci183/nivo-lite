/** The structured log events of the hiring capability. */
export enum HiringLogEvent {
    /** A step of the hiring tick failed for one workspace; the other workspaces still run. */
    TickFailed = "hiring.tick-failed",
    /** Asking the gate about a candidate step failed; the step stays pending. */
    AskFailed = "hiring.ask-failed",
}
