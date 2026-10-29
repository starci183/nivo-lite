/** Log events of the storage integration. */
export enum StorageLogEvent {
    /** The object store refused or could not be reached. */
    Failed = "storage.failed",
    /** A bucket exists with the right policy. */
    BucketReady = "storage.bucket.ready",
}
