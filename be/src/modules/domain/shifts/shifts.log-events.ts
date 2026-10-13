/** The structured log events of the shifts capability. */
export enum ShiftsLogEvent {
    /** A member command ended in an error that is not a refusal in words. */
    CommandFailed = "shifts.command-failed",
    /** Asking the owner to approve a request failed; the request stays pending. */
    AskFailed = "shifts.ask-failed",
}
