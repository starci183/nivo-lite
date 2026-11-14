/** Log events of the record files. */
export enum RecordFilesLogEvent {
    /** The record no longer references an object, but the store could not remove it; the object stays until a sweep. */
    ObjectKept = "record-files.object.kept",
}
