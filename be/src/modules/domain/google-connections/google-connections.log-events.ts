/** Log events of the google-connections capability. */
export enum GoogleConnectionsLogEvent {
    /** A callback state could not be read; the browser goes back with reason=state. */
    StateUnreadable = "google_connections.state_unreadable",
    /** The person in the state may no longer connect Google; the browser goes back with reason=forbidden. */
    ConsentForbidden = "google_connections.consent_forbidden",
    /** A refused consent could not be remembered on the connection; the browser still goes back with the reason. */
    FailureNotRecorded = "google_connections.failure_not_recorded",
    /** A consent code could not be turned into a stored connection or grant; the browser goes back with the reason. */
    ConsentFailed = "google_connections.consent_failed",
}
