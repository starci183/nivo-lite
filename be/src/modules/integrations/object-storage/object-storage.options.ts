import type { Secret } from "@modules/platform/config"

/** Object storage configuration parsed once at boot. */
export interface ObjectStorageOptions {
    /** The S3 address the back end itself calls: MinIO on the internal network (`http://academy-minio:9000`) or its public origin. */
    readonly endpoint: string
    /** The S3 region the requests are signed for; MinIO accepts any, `us-east-1` by default. */
    readonly region: string
    /** The access key of the store account. */
    readonly accessKey: Secret
    /** The secret key of the store account. */
    readonly secretKey: Secret
    /** Names the environment: every bucket is `<prefix>-<purpose>` (`nivo-media`, `nivo-dev-media`). */
    readonly bucketPrefix: string
    /** The origin browsers reach the store at: presigned addresses are signed for it and public objects are read from it. */
    readonly publicUrl: string
    /** How long one call to the store may take, in milliseconds. */
    readonly timeoutMs: number
}
