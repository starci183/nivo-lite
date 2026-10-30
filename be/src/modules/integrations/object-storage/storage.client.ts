import {
    CreateBucketCommand,
    DeleteObjectsCommand,
    GetObjectCommand,
    HeadBucketCommand,
    HeadObjectCommand,
    ListObjectsV2Command,
    PutBucketPolicyCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3"
import type { S3Client } from "@aws-sdk/client-s3"
import { Injectable } from "@nestjs/common"
import { eachInOrder } from "@modules/platform/primitives"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import type { FoundObject, FoundSize, ListedObject, StorageClient } from "./object-storage.contracts"
import { InjectS3Client, InjectStorageOptions, InjectStorageSigner } from "./storage.decorators"
import type { ObjectStorageOptions } from "./storage.options"
import { withoutTrailingSlashes } from "./object-storage.policy"
import type { StorageSigner } from "./s3.client"

const NOT_FOUND = new Set(["NoSuchKey", "NotFound", "NoSuchBucket"])
const DELETE_BATCH = 1000

/** The send option that ends a call after the configured time. */
interface AbortOptions {
    readonly abortSignal: AbortSignal
}

/** One listed file with the instant it is ordered by. */
interface DatedObject extends ListedObject {
    readonly at: number
}

const nameOf = (failure: unknown): string => (failure instanceof Error ? failure.name : "")

/** A ObjectStorageError for any failure of the store, keeping the cause. */
const refusal = (failure: unknown): ObjectStorageError =>
    failure instanceof ObjectStorageError
        ? failure
        : new ObjectStorageError({ code: ObjectStorageErrorCode.ProviderUnavailable, cause: failure })

const refuse = (failure: unknown): never => {
    throw refusal(failure)
}

const readPolicy = (bucket: string): string =>
    JSON.stringify({
        Version: "2012-10-17",
        Statement: [
            {
                Effect: "Allow",
                Principal: { AWS: ["*"] },
                Action: ["s3:GetObject"],
                Resource: [`arn:aws:s3:::${bucket}/*`],
            },
        ],
    })

@Injectable()
/** The S3 operations of the integration over the AWS SDK; calls go to the internal endpoint, presigned addresses are signed by the public-origin signer. */
export class S3StorageClient implements StorageClient {
    constructor(
        @InjectS3Client() private readonly s3: S3Client,
        @InjectStorageSigner() private readonly signer: StorageSigner,
        @InjectStorageOptions() private readonly options: ObjectStorageOptions,
    ) {}

    /** Writes one object, replacing an earlier one at the key. */
    async put(bucket: string, key: string, body: Uint8Array, contentType: string): Promise<void> {
        await this.s3
            .send(
                new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
                this.abort(),
            )
            .catch(refuse)
    }

    /** Reads one object; null when it is not there. */
    async get(bucket: string, key: string): Promise<FoundObject> {
        try {
            const found = await this.s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), this.abort())
            const bytes = (await found.Body?.transformToByteArray()) ?? new Uint8Array()
            return { bytes, contentType: found.ContentType ?? "application/octet-stream" }
        } catch (failure) {
            if (NOT_FOUND.has(nameOf(failure))) return null
            throw refusal(failure)
        }
    }

    /** The size of one object; null when it is not there. */
    async head(bucket: string, key: string): Promise<FoundSize> {
        try {
            const found = await this.s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), this.abort())
            return { size: found.ContentLength ?? 0 }
        } catch (failure) {
            if (NOT_FOUND.has(nameOf(failure))) return null
            throw refusal(failure)
        }
    }

    /** Removes the objects in batches of one thousand; answers how many the store reports removed. */
    async remove(bucket: string, keys: ReadonlyArray<string>): Promise<number> {
        const batches = Array.from({ length: Math.ceil(keys.length / DELETE_BATCH) }, (_, index) =>
            keys.slice(index * DELETE_BATCH, (index + 1) * DELETE_BATCH),
        )
        let removed = 0
        await eachInOrder(batches, async (batch) => {
            const Objects = batch.map((Key) => ({ Key }))
            const answer = await this.s3
                .send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects } }), this.abort())
                .catch(refuse)
            removed += answer.Deleted?.length ?? 0
        })
        return removed
    }

    /** The files directly under a folder, newest first, up to `limit`. */
    async list(bucket: string, folder: string, limit: number): Promise<ReadonlyArray<ListedObject>> {
        const prefix = folder === "" ? "" : `${withoutTrailingSlashes(folder)}/`
        const found = await this.pageFrom(bucket, prefix, undefined)
        const newestFirst = found.toSorted((left, right) => right.at - left.at)
        return newestFirst.slice(0, limit).map(({ name, createdAt }) => ({ name, createdAt }))
    }

    /** A presigned read address valid for `expiresIn` seconds. */
    presignGet(bucket: string, key: string, expiresIn: number): Promise<string> {
        return this.signer.sign(new GetObjectCommand({ Bucket: bucket, Key: key }), expiresIn).catch(refuse)
    }

    /** A presigned upload address valid for `expiresIn` seconds. */
    presignPut(bucket: string, key: string, expiresIn: number): Promise<string> {
        return this.signer.sign(new PutObjectCommand({ Bucket: bucket, Key: key }), expiresIn).catch(refuse)
    }

    /** Creates the bucket when it is missing; a public one gets an anonymous read policy. */
    async ensureBucket(bucket: string, publicRead: boolean): Promise<void> {
        try {
            await this.s3.send(new HeadBucketCommand({ Bucket: bucket }), this.abort())
        } catch (failure) {
            if (!NOT_FOUND.has(nameOf(failure))) throw refusal(failure)
            await this.s3.send(new CreateBucketCommand({ Bucket: bucket }), this.abort()).catch(refuse)
        }
        if (publicRead) {
            await this.s3
                .send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: readPolicy(bucket) }), this.abort())
                .catch(refuse)
        }
    }

    private abort(): AbortOptions {
        return { abortSignal: AbortSignal.timeout(this.options.timeoutMs) }
    }

    private async pageFrom(bucket: string, prefix: string, token: string | undefined): Promise<Array<DatedObject>> {
        const page = await this.s3
            .send(
                new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: "/", ContinuationToken: token }),
                this.abort(),
            )
            .catch(refuse)
        const entries = (page.Contents ?? []).flatMap((entry) =>
            entry.Key === undefined || entry.Key === prefix
                ? []
                : [
                      {
                          name: entry.Key.slice(prefix.length),
                          createdAt: entry.LastModified?.toISOString() ?? null,
                          at: entry.LastModified?.getTime() ?? 0,
                      },
                  ],
        )
        const next = page.IsTruncated === true ? page.NextContinuationToken : undefined
        return next === undefined ? entries : [...entries, ...(await this.pageFrom(bucket, prefix, next))]
    }
}
