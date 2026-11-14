import type { InjectionToken } from "@nestjs/common"

/** The object storage provider the app root supplies. */
export interface ChatFilesOptions {
    /** Provider token of a StorageObjectsPort implementation. */
    readonly storage: InjectionToken
    /** Provider token of a StorageAssetsPort implementation: where a customer's picture is kept; absent keeps none (the line says so). */
    readonly assets?: InjectionToken | undefined
}
