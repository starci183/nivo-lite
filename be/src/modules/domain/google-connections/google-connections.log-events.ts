/** Log events of the google-connections capability. */
export enum GoogleConnectionsLogEvent {
    /** The signed state of a consent return could not be read; the browser goes back with `reason=state`. */
    StateUnreadable = "google_connections.state_unreadable",
    /** The person of a consent return may no longer manage the workspace; the browser goes back with `reason=forbidden`. */
    ConsentForbidden = "google_connections.consent_forbidden",
    /** A refused consent could not be recorded on the connection. */
    FailureNotRecorded = "google_connections.failure_not_recorded",
    /** The consent return failed after the state was verified; the browser goes back with `reason=failed`. */
    ConsentFailed = "google_connections.consent_failed",
}
