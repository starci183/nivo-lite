import type { MockOf } from "@starci/jest-preset"
import type { StorageClient, StoredObject } from "@modules/integrations/object-storage"

/** One presigned address the fake handed out. */
export interface PresignedCall {
    /** The HTTP verb the address was signed for. */
    readonly verb: "GET" | "PUT"
    /** The physical bucket. */
    readonly bucket: string
    /** The object key. */
    readonly key: string
    /** The TTL asked for, in seconds. */
    readonly expiresIn: number
}

/** The in-memory S3 store behind a storage client double. */
export interface FakeStorage {
    /** Objects by `bucket/key`. */
    readonly objects: Map<string, StoredObject>
    /** Every presigned address handed out. */
    readonly presigned: Array<PresignedCall>
    /** Buckets ensured, with whether they were opened to anonymous reads. */
    readonly buckets: Map<string, boolean>
}

/** Backs the methods of a `mock<StorageClient>()` with an in-memory store: presigned addresses name what they were signed for. */
export const fakeStorage = (client: MockOf<StorageClient>): FakeStorage => {
    const objects = new Map<string, StoredObject>()
    const presigned: Array<PresignedCall> = []
    const buckets = new Map<string, boolean>()
    client.put.mockImplementation((bucket, key, body, contentType) => {
        objects.set(`${bucket}/${key}`, { bytes: body, contentType })
        return Promise.resolve()
    })
    client.get.mockImplementation((bucket, key) => Promise.resolve(objects.get(`${bucket}/${key}`) ?? null))
    client.head.mockImplementation((bucket, key) => {
        const found = objects.get(`${bucket}/${key}`)
        return Promise.resolve(found === undefined ? null : { size: found.bytes.byteLength })
    })
    client.remove.mockImplementation((bucket, keys) =>
        Promise.resolve(keys.filter((key) => objects.delete(`${bucket}/${key}`)).length),
    )
    client.list.mockImplementation((bucket, folder) => {
        const prefix = `${bucket}/${folder}/`
        return Promise.resolve(
            [...objects.keys()]
                .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes("/"))
                .map((key) => ({ name: key.slice(prefix.length), createdAt: null })),
        )
    })
    client.presignGet.mockImplementation((bucket, key, expiresIn) => {
        presigned.push({ verb: "GET", bucket, key, expiresIn })
        return Promise.resolve(`https://store.test/${bucket}/${key}?expires=${expiresIn}`)
    })
    client.presignPut.mockImplementation((bucket, key, expiresIn) => {
        presigned.push({ verb: "PUT", bucket, key, expiresIn })
        return Promise.resolve(`https://store.test/${bucket}/${key}?expires=${expiresIn}`)
    })
    client.ensureBucket.mockImplementation((bucket, publicRead) => {
        buckets.set(bucket, publicRead)
        return Promise.resolve()
    })
    return { objects, presigned, buckets }
}
