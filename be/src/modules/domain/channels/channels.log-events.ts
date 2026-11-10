/** Log events of the channels capability. */
export enum ChannelsLogEvent {
    /** A reply was kept in the conversation and not pushed, because the customer has no recipient on the channel yet. */
    RecipientNotLinked = "channels.delivery.recipient_not_linked",
    /** A scheduled Zalo token refresh failed for one connection; the connection id rides in the fields. */
    ZaloRefreshFailed = "channels.zalo.refresh-failed",
    /** A reply could not be pushed to the customer's channel; the reply stays stored and visible. */
    DeliveryFailed = "channels.delivery.failed",
    /** The refresh lease could not be released; it expires on its own. */
    LeaseNotReleased = "channels.zalo.lease-not-released",
    /** A Zalo webhook call reached a connection that cannot prove events yet (unknown, or no OA secret key): answered 200 and dropped. */
    ZaloWebhookUnverified = "zalo.webhook.unverified",
    /** A webhook body was not the JSON its mac covers. */
    ProofBodyUnreadable = "channels.proof.body-unreadable",
    /** A connection is failing or silent; the owner should look at it. */
    ConnectionUnhealthy = "channels.connection.unhealthy",
    /** Zalo refused the returned authorization (or the state was wrong); the connection is marked failing. */
    ZaloAuthorizationRefused = "channels.zalo.authorization-refused",
    /** The first save of renewed Zalo tokens failed and is tried once more. */
    ZaloSaveRetried = "channels.zalo.save-retried",
    /** The Zalo text went out but the QR image that should follow it was refused; the link in the text still works. */
    QrImageFailed = "channels.zalo.qr-image-failed",
    /** The Zalo text went out but a picture that should follow it was refused; the pictures after it were not sent. */
    ImageFailed = "channels.zalo.image-failed",
    /** The collage of several photos could not be built or stored; the photos go one by one instead. */
    CollageFailed = "channels.collage.failed",
    /** The collage was built and stored, but Zalo refused it; the photos go one by one instead. */
    CollageRefused = "channels.zalo.collage-refused",
    /** The Telegram album or photo that should follow the text was refused; the text already reached the customer. */
    AlbumFailed = "channels.telegram.album-failed",
    /** The Zalo chat window is closed and the ZNS fallback could not be used; the reason rides in the fields. */
    ZnsFallbackSkipped = "channels.zalo.zns-fallback-skipped",
    /** A message outside the chat window went out as a ZNS template message. */
    ZnsSent = "channels.zalo.zns-sent",
    /** A wizard step was refused for a reason the owner can act on; the connection id and the command ride in the fields. */
    ZaloWizardRefused = "channels.zalo.wizard-refused",
    /** The OA's display name could not be read from Zalo; the account keeps its connection name until a later view tries again. */
    ZaloOaNameUnread = "channels.zalo.oa-name-unread",
}
