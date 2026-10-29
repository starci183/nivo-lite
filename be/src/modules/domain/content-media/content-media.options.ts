import type { InjectionToken } from "@nestjs/common"

/** The object storage provider the app root supplies. */
export interface ContentMediaOptions {
    /** Provider token of a StorageObjectsPort implementation. */
    readonly storage: InjectionToken
}
