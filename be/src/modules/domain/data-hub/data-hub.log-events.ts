/** Log events of the data-hub capability. */
export enum DataHubLogEvent {
    /** A sync failed; the owner reads the reason on the connection. */
    SyncFailed = "data_hub.sync_failed",
    /** The failure of a sync could not be written to the connection. */
    SyncCrashed = "data_hub.sync_crashed",
}
