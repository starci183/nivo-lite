import type { InjectionToken } from "@nestjs/common"

/** The object storage provider the app root supplies. */
export interface ChatFilesOptions {
    /** Provider token of a StorageObjectsPort implementation. */
    readonly storage: InjectionToken
    /** Provider token of a StorageAssetsPort implementation: where the files a channel brings in are written. */
    readonly assets: InjectionToken
    /** The folder a manual import's local paths are read from; nothing outside it can be read. */
    readonly importRoot: string
}
