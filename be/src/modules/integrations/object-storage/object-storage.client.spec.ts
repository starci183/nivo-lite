import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { isRecord } from "@modules/platform/primitives"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import { S3StorageClient } from "./object-storage.client"
import { S3_CLIENT, STORAGE_OPTIONS, STORAGE_SIGNER } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"
import type { StorageSigner } from "./s3.client"

/** The class of a command; the spec reads its name. */
interface CommandClass {
    readonly name: string
}

/** The one method of the AWS client the subject calls, with the command shape the spec reads. */
interface SendCommand {
    readonly constructor: CommandClass
    readonly input: Record<string, unknown>
}

/** The option every call carries. */
interface CallOptions {
    readonly abortSignal: AbortSignal
}

interface FakeS3 {
    send(command: SendCommand, options: CallOptions): Promise<unknown>
}

interface Sent {
    readonly kind: string
    readonly input: Record<string, unknown>
}

type Answer = () => unknown

const options: ObjectStorageOptions = {
    endpoint: "https://academy-minio.test:9000",
    region: "us-east-1",
    accessKey: new Secret("key"),
    secretKey: new Secret("secret"),
    bucketPrefix: "nivo",
    publicUrl: "https://minio.example.org",
    timeoutMs: 1000,
}

const named = (name: string): Error => Object.assign(new Error(name), { name })
const fails =
    (failure: unknown): Answer =>
    () =>
        Promise.reject(failure)

/** How many keys a delete command carries. */
const deletedCount = (input: Record<string, unknown>): number => {
    const deletion = input.Delete
    return isRecord(deletion) && Array.isArray(deletion.Objects) ? deletion.Objects.length : -1
}

const build = async () => {
    const sent: Array<Sent> = []
    const answers: Array<Answer> = []
    const s3 = mock<FakeS3>()
    s3.send.mockImplementation((command) => {
        sent.push({ kind: command.constructor.name, input: command.input })
        const answer = answers.shift()
        return Promise.resolve().then(() => (answer === undefined ? {} : answer()))
    })
    const signer = mock<StorageSigner>()
    signer.sign.mockImplementation((command, expiresIn) =>
        Promise.resolve(`signed:${command.constructor.name}:${String(expiresIn)}`),
    )
    const moduleRef = await Test.createTestingModule({
        providers: [
            S3StorageClient,
            { provide: S3_CLIENT, useValue: s3 },
            { provide: STORAGE_SIGNER, useValue: signer },
            { provide: STORAGE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client: moduleRef.get(S3StorageClient), sent, answers, signer }
}

describe("S3StorageClient / put", () => {
    it("writes an object with its content type", async () => {
        const { client, sent } = await build()

        await client.put("b", "k", new Uint8Array([1]), "image/png")

        expect(sent).toEqual([
            {
                kind: "PutObjectCommand",
                input: { Bucket: "b", Key: "k", Body: new Uint8Array([1]), ContentType: "image/png" },
            },
        ])
    })

    it("refuses with a ObjectStorageError, keeping one that is already a ObjectStorageError", async () => {
        const { client, answers } = await build()
        const own = new ObjectStorageError({ code: ObjectStorageErrorCode.KeyInvalid })
        answers.push(fails(new Error("down")), fails(own))

        await expect(client.put("b", "k", new Uint8Array(), "x/y")).rejects.toMatchObject({
            code: ObjectStorageErrorCode.ProviderUnavailable,
        })
        await expect(client.put("b", "k", new Uint8Array(), "x/y")).rejects.toBe(own)
    })
})

describe("S3StorageClient / get and head", () => {
    it("reads the bytes and content type, and defaults both when the store omits them", async () => {
        const { client, answers } = await build()
        answers.push(() => ({
            Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([9])) },
            ContentType: "text/plain",
        }))
        answers.push(() => ({}))

        await expect(client.get("b", "k")).resolves.toEqual({ bytes: new Uint8Array([9]), contentType: "text/plain" })
        await expect(client.get("b", "k")).resolves.toEqual({
            bytes: new Uint8Array(),
            contentType: "application/octet-stream",
        })
    })

    it("answers null for a missing key and refuses on other failures, including one that is not an Error", async () => {
        const { client, answers } = await build()
        answers.push(fails(named("NoSuchKey")), fails(new Error("down")), fails("plain text"))

        await expect(client.get("b", "k")).resolves.toBeNull()
        await expect(client.get("b", "k")).rejects.toBeInstanceOf(ObjectStorageError)
        await expect(client.get("b", "k")).rejects.toBeInstanceOf(ObjectStorageError)
    })

    it("measures an object, answers null for a missing one and refuses on other failures", async () => {
        const { client, answers } = await build()
        answers.push(
            () => ({ ContentLength: 5 }),
            () => ({}),
            fails(named("NotFound")),
            fails(new Error("down")),
        )

        await expect(client.head("b", "k")).resolves.toEqual({ size: 5 })
        await expect(client.head("b", "k")).resolves.toEqual({ size: 0 })
        await expect(client.head("b", "k")).resolves.toBeNull()
        await expect(client.head("b", "k")).rejects.toBeInstanceOf(ObjectStorageError)
    })
})

describe("S3StorageClient / remove", () => {
    it("deletes in batches of one thousand and counts what the store reports", async () => {
        const { client, sent, answers } = await build()
        const keys = Array.from({ length: 1001 }, (_, index) => `k${String(index)}`)
        answers.push(
            () => ({ Deleted: Array.from({ length: 1000 }, () => ({})) }),
            () => ({}),
        )

        await expect(client.remove("b", keys)).resolves.toBe(1000)

        expect(sent.map((entry) => deletedCount(entry.input))).toEqual([1000, 1])
    })

    it("refuses with a ObjectStorageError when the store fails", async () => {
        const { client, answers } = await build()
        answers.push(fails(new Error("down")))

        await expect(client.remove("b", ["k"])).rejects.toBeInstanceOf(ObjectStorageError)
    })
})

describe("S3StorageClient / list", () => {
    it("lists the files directly under a folder across pages, newest first, cut to the limit", async () => {
        const { client, sent, answers } = await build()
        answers.push(() => ({
            Contents: [
                { Key: "ws/" },
                { Key: "ws/old.png", LastModified: new Date("2026-01-01T00:00:00Z") },
                { Key: undefined },
                { Key: "ws/undated.png" },
            ],
            IsTruncated: true,
            NextContinuationToken: "t2",
        }))
        answers.push(() => ({ Contents: [{ Key: "ws/new.png", LastModified: new Date("2026-02-01T00:00:00Z") }] }))

        await expect(client.list("b", "ws/", 2)).resolves.toEqual([
            { name: "new.png", createdAt: "2026-02-01T00:00:00.000Z" },
            { name: "old.png", createdAt: "2026-01-01T00:00:00.000Z" },
        ])

        expect(sent.map((entry) => entry.input.ContinuationToken)).toEqual([undefined, "t2"])
        expect(sent[0]?.input.Prefix).toBe("ws/")
    })

    it("lists the bucket root with an empty prefix, treats a page without contents as empty and refuses on failure", async () => {
        const { client, sent, answers } = await build()
        answers.push(() => ({}), fails(new Error("down")))

        await expect(client.list("b", "", 5)).resolves.toEqual([])
        await expect(client.list("b", "", 5)).rejects.toBeInstanceOf(ObjectStorageError)
        expect(sent[0]?.input.Prefix).toBe("")
    })
})

describe("S3StorageClient / presign", () => {
    it("asks the signer for reads and uploads with the asked TTL", async () => {
        const { client } = await build()

        await expect(client.presignGet("b", "k", 60)).resolves.toBe("signed:GetObjectCommand:60")
        await expect(client.presignPut("b", "k", 900)).resolves.toBe("signed:PutObjectCommand:900")
    })

    it("refuses with a ObjectStorageError when signing fails", async () => {
        const { client, signer } = await build()
        signer.sign.mockRejectedValue(new Error("no keys"))

        await expect(client.presignGet("b", "k", 60)).rejects.toBeInstanceOf(ObjectStorageError)
    })
})

describe("S3StorageClient / ensureBucket", () => {
    it("leaves an existing private bucket alone", async () => {
        const { client, sent } = await build()

        await client.ensureBucket("b", false)

        expect(sent.map((entry) => entry.kind)).toEqual(["HeadBucketCommand"])
    })

    it("creates a missing bucket and opens a public one to anonymous reads", async () => {
        const { client, sent, answers } = await build()
        answers.push(fails(named("NotFound")))

        await client.ensureBucket("pics", true)

        expect(sent.map((entry) => entry.kind)).toEqual([
            "HeadBucketCommand",
            "CreateBucketCommand",
            "PutBucketPolicyCommand",
        ])
        expect(String(sent[2]?.input.Policy)).toContain("arn:aws:s3:::pics/*")
    })

    it("refuses when the head, the create or the policy fails", async () => {
        const { client, answers } = await build()
        answers.push(fails(new Error("down")))
        await expect(client.ensureBucket("b", false)).rejects.toBeInstanceOf(ObjectStorageError)

        answers.push(fails(named("NoSuchBucket")), fails(new Error("down")))
        await expect(client.ensureBucket("b", false)).rejects.toBeInstanceOf(ObjectStorageError)

        answers.push(() => ({}), fails(new Error("down")))
        await expect(client.ensureBucket("b", true)).rejects.toBeInstanceOf(ObjectStorageError)
    })
})
