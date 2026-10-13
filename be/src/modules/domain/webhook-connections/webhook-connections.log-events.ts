/** Log events of the webhook-connections capability. */
export enum WebhookConnectionsLogEvent {
    /** A delivery was dropped: the connection is gone, off or without an address, or signing is off. */
    DeliveryDropped = "webhook_connections.delivery_dropped",
    /** The receiver refused a delivery for good (an address NIVO may not call, or a 4xx answer); it is not retried. */
    DeliveryRefused = "webhook_connections.delivery_refused",
    /** The stored address of a connection could not be read. */
    AddressUnreadable = "webhook_connections.address_unreadable",
}
