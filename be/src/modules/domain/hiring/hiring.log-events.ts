/** The structured log events of the hiring capability. */
export enum HiringLogEvent {
    /** A step of the hiring tick failed for one workspace; the other workspaces still run. */
    TickFailed = "hiring.tick-failed",
    /** Asking the gate about a candidate step failed; the step stays pending. */
    AskFailed = "hiring.ask-failed",
    /** A message to a candidate could not be stored or delivered in their chat; the caller falls back to email or a link. */
    ChatDeliveryFailed = "hiring.chat-delivery-failed",
}
