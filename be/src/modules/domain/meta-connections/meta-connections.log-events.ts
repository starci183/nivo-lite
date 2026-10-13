/** Log events of the meta-connections capability. */
export enum MetaConnectionsLogEvent {
    /** The app-level webhook subscription could not be (re)made; the Page subscription still stands. */
    AppSubscriptionFailed = "meta_connections.app_subscription_failed",
    /** The Meta login return failed after the state was verified; the wizard shows "failed". */
    CallbackFailed = "meta_connections.callback_failed",
    /** The signed state of a login return could not be read; the wizard shows "expired". */
    StateUnreadable = "meta_connections.state_unreadable",
    /** The credential or the Page subscription of a disconnecting connection could not be released. */
    ReleaseFailed = "meta_connections.release_failed",
    /** A message to a Facebook or Instagram customer could not be sent because its connection could not be read. */
    SendUnavailable = "meta_connections.send_unavailable",
}
