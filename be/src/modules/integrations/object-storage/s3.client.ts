import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import type { ObjectStorageOptions } from "./storage.options"

/** A command a presigned address can be made for. */
export type SignableCommand = GetObjectCommand | PutObjectCommand

/** Makes presigned addresses. */
export interface StorageSigner {
    /** The presigned address of a command, valid for `expiresIn` seconds. */
    sign(command: SignableCommand, expiresIn: number): Promise<string>
}

/** The AWS SDK client of one S3 address, path-style as MinIO expects; the SDK is imported nowhere else. */
export const createS3Client = (options: ObjectStorageOptions, endpoint: string): S3Client =>
    new S3Client({
        endpoint,
        region: options.region,
        credentials: { accessKeyId: options.accessKey.reveal(), secretAccessKey: options.secretKey.reveal() },
        forcePathStyle: true,
        maxAttempts: 2,
    })

/** Signs for the public origin: the signature covers the host a browser will send the request to, not the internal one. */
export const createStorageSigner = (options: ObjectStorageOptions): StorageSigner => {
    const publicClient = createS3Client(options, options.publicUrl)
    return { sign: (command, expiresIn) => getSignedUrl(publicClient, command, { expiresIn }) }
}
