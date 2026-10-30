import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3"
import { Test } from "@nestjs/testing"
import { Secret } from "@modules/platform/config"
import type { ObjectStorageOptions } from "./object-storage.options"
import { createS3Client as realCreateS3Client, createStorageSigner as realCreateStorageSigner } from "./s3.client"

const SUBJECT = Symbol("storage.sdk")

type Subject = {
    createS3Client: typeof realCreateS3Client
    createStorageSigner: typeof realCreateStorageSigner
}

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { createS3Client: realCreateS3Client, createStorageSigner: realCreateStorageSigner },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const options: ObjectStorageOptions = {
    endpoint: "https://academy-minio.test:9000",
    region: "us-east-1",
    accessKey: new Secret("access"),
    secretKey: new Secret("secret"),
    bucketPrefix: "nivo",
    publicUrl: "https://minio.example.org",
    timeoutMs: 1000,
}

describe("createS3Client", () => {
    it("points at the given endpoint, path-style, with the region of the options", async () => {
        const subject = await build()

        const client = subject.createS3Client(options, options.endpoint)

        expect(client.config.forcePathStyle).toBe(true)
        await expect(client.config.region()).resolves.toBe("us-east-1")
        await expect(client.config.endpoint?.()).resolves.toMatchObject({ hostname: "academy-minio.test", port: 9000 })
    })
})

describe("createStorageSigner", () => {
    it("signs reads and uploads for the public origin with the asked TTL", async () => {
        const subject = await build()
        const signer = subject.createStorageSigner(options)

        const read = new URL(await signer.sign(new GetObjectCommand({ Bucket: "nivo-media", Key: "ws/a.png" }), 60))
        const write = new URL(await signer.sign(new PutObjectCommand({ Bucket: "nivo-media", Key: "ws/a.png" }), 900))

        expect(read.origin).toBe("https://minio.example.org")
        expect(read.pathname).toBe("/nivo-media/ws/a.png")
        expect(read.searchParams.get("X-Amz-Expires")).toBe("60")
        expect(write.searchParams.get("X-Amz-Expires")).toBe("900")
    })
})
