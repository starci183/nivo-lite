/** Log events of the realtime capability. */
export enum RealtimeLogEvent {
    /** The LISTEN connection of the Postgres hub was lost; the hub reconnects and then reloads what it missed. */
    ListenLost = "realtime.listen.lost",
    /** The LISTEN connection could not be opened again; the hub tries again after a pause. */
    ListenFailed = "realtime.listen.failed",
    /** A Redis connection of the Redis hub reported a failure; ioredis reconnects by itself. */
    RedisFailed = "realtime.redis.failed",
    /** The frames missed during a connection loss could not be reloaded; delivery stays paused until a retry succeeds. */
    CatchUpFailed = "realtime.catch-up.failed",
    /** A notification could not be delivered to the subscribers of this replica. */
    DeliveryFailed = "realtime.delivery.failed",
    /** A notification on the channel did not have the shape the hub publishes. */
    NotificationIgnored = "realtime.notification.ignored",
}
