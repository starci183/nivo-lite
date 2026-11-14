import type { InjectionToken } from "@nestjs/common"

/** The providers the app root supplies to the record files. */
export interface RecordFilesOptions {
    /** Provider token of the one file store of the records (a `StorageFilesPort`: `STORAGE_FILES` of the object storage integration). */
    readonly storage: InjectionToken
}
