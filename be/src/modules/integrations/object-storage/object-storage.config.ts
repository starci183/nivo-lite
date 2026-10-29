import type { EnvSource } from "@modules/platform/config"
import type { ObjectStorageOptions } from "./object-storage.options"

const DEFAULT_REGION = "us-east-1"
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Reads the object storage configuration with no credential default. `STORAGE_PUBLIC_URL` is the origin browsers use
 * (`https://minio.starci.org`); it defaults to the endpoint, which is right only when the endpoint is itself public.
 */
export const parseObjectStorageConfig = (env: EnvSource): ObjectStorageOptions => {
    const endpoint = env.url("STORAGE_ENDPOINT")
    return {
        endpoint,
        region: env.optional("STORAGE_REGION") ?? DEFAULT_REGION,
        accessKey: env.secret("STORAGE_ACCESS_KEY"),
        secretKey: env.secret("STORAGE_SECRET_KEY"),
        bucketPrefix: env.string("STORAGE_BUCKET_PREFIX"),
        publicUrl: env.optional("STORAGE_PUBLIC_URL") ?? endpoint,
        timeoutMs: env.int("STORAGE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    }
}
