import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { fakeStorage } from "@tests/fixtures/doubles/fake-storage.client"
import type { StorageClient } from "./object-storage.contracts"
import { StorageObjectsService } from "./object-storage-objects.service"
import { STORAGE_CLIENT, STORAGE_OPTIONS } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"
import { MAX_PRESIGN_SECONDS, UPLOAD_URL_SECONDS } from "./object-storage.policy"

const options: ObjectStorageOptions = {
    endpoint: "https://academy-minio.test:9000",
    region: "us-east-1",
    accessKey: new Secret("a"),
    secretKey: new Secret("b"),
    bucketPrefix: "nivo",
    publicUrl: "https://minio.example.org",
    timeoutMs: 1000,
}

const build = async () => {
    const client = mock<StorageClient>()
    const { presigned } = fakeStorage(client)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            StorageObjectsService,
            { provide: STORAGE_CLIENT, useValue: client },
            { provide: STORAGE_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { client, presigned, logger, service: moduleRef.get(StorageObjectsService) }
}

describe("StorageObjectsService", () => {
    it("signs an upload under the environment bucket with the upload TTL and no token", async () => {
        const { presigned, service } = await build()

        const signed = await service.signedUpload("media", "ws/a.png")

        expect(signed).toEqual({
            kind: "ok",
            value: {
                path: "ws/a.png",
                token: "",
                signedUrl: `https://store.test/nivo-media/ws/a.png?expires=${UPLOAD_URL_SECONDS}`,
            },
        })
        expect(presigned).toEqual([
            { verb: "PUT", bucket: "nivo-media", key: "ws/a.png", expiresIn: UPLOAD_URL_SECONDS },
        ])
    })

    it("signs reads for the asked TTL, clamped to the longest the signature allows, and omits missing objects", async () => {
        const { client, service } = await build()
        await client.put("nivo-hiring", "cv/there.pdf", new Uint8Array([1]), "application/pdf")

        const signed = await service.signedUrls("hiring", ["cv/there.pdf", "cv/gone.pdf"], MAX_PRESIGN_SECONDS * 3)

        expect(signed).toEqual({
            kind: "ok",
            value: [
                {
                    path: "cv/there.pdf",
                    signedUrl: `https://store.test/nivo-hiring/cv/there.pdf?expires=${MAX_PRESIGN_SECONDS}`,
                },
            ],
        })
    })
})

describe("StorageObjectsService / reads", () => {
    it("downloads the bytes and says NOT_FOUND for an object that is not there or a key that is not valid", async () => {
        const { client, service } = await build()
        await client.put("nivo-knowledge-uploads", "ws/u/doc.txt", new Uint8Array([7]), "text/plain")

        await expect(service.download("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({
            kind: "ok",
            value: { bytes: new Uint8Array([7]), contentType: "text/plain" },
        })
        await expect(service.download("knowledge-uploads", "ws/u/none.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        await expect(service.download("knowledge-uploads", "../x")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
    })

    it("logs and answers UNAVAILABLE when the store fails", async () => {
        const { client, logger, service } = await build()
        client.get.mockRejectedValueOnce(new Error("down"))

        await expect(service.download("media", "ws/a.png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("removes objects and counts only those that existed", async () => {
        const { client, service } = await build()
        await client.put("nivo-media", "ws/a.png", new Uint8Array([1]), "image/png")

        await expect(service.remove("media", ["ws/a.png", "ws/b.png"])).resolves.toEqual({ kind: "ok", value: 1 })
    })

    it("builds the public address of a public bucket object from the public origin", async () => {
        const { service } = await build()

        expect(service.publicUrl("avatars_public", "people/1.png")).toBe(
            "https://minio.example.org/nivo-avatars-public/people/1.png",
        )
    })

    it("lists a folder, answers nothing for no paths and says UNAVAILABLE when removal fails", async () => {
        const { client, service } = await build()
        await client.put("nivo-media", "ws/a.png", new Uint8Array([1]), "image/png")

        await expect(service.list("media", "ws", 10)).resolves.toEqual({
            kind: "ok",
            value: [{ name: "a.png", createdAt: null }],
        })
        await expect(service.signedUrls("media", [], 60)).resolves.toEqual({ kind: "ok", value: [] })
        await expect(service.remove("media", [])).resolves.toEqual({ kind: "ok", value: 0 })
        client.remove.mockRejectedValueOnce(new Error("down"))
        await expect(service.remove("media", ["ws/a.png"])).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })

    it("signs an upload and read address as UNAVAILABLE when the signer fails", async () => {
        const { client, service } = await build()
        client.presignPut.mockRejectedValueOnce(new Error("no keys"))

        await expect(service.signedUpload("media", "ws/a.png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })
})

describe("StorageObjectsService / sizes", () => {
    it("answers the size of an object without reading it, NOT_FOUND when it is not there and UNAVAILABLE when the store fails", async () => {
        const { client, service } = await build()
        await client.put("nivo-knowledge-uploads", "ws/u/doc.txt", new Uint8Array([7, 8, 9]), "text/plain")

        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({ kind: "ok", value: 3 })
        await expect(service.sizeOf("knowledge-uploads", "ws/u/none.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        client.head.mockRejectedValueOnce(new Error("down"))
        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })
})
