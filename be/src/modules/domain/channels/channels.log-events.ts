/** Log events of the channels capability. */
export enum ChannelsLogEvent {
    /** A scheduled Zalo token refresh failed for one connection; the connection id rides in the fields. */
    ZaloRefreshFailed = "channels.zalo.refresh-failed",
    /** A reply could not be pushed to the customer's channel; the reply stays stored and visible. */
    DeliveryFailed = "channels.delivery.failed",
    /** The refresh lease could not be released; it expires on its own. */
    LeaseNotReleased = "channels.zalo.lease-not-released",
    /** A webhook body was not the JSON its mac covers. */
    ProofBodyUnreadable = "channels.proof.body-unreadable",
    /** A connection is failing or silent; the owner should look at it. */
    ConnectionUnhealthy = "channels.connection.unhealthy",
    /** Zalo refused the returned authorization (or the state was wrong); the connection is marked failing. */
    ZaloAuthorizationRefused = "channels.zalo.authorization-refused",
    /** The first save of renewed Zalo tokens failed and is tried once more. */
    ZaloSaveRetried = "channels.zalo.save-retried",
    /** A wizard step was refused for a reason the owner can act on; the connection id and the command ride in the fields. */
    ZaloWizardRefused = "channels.zalo.wizard-refused",
}
