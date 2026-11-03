import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OBJECT_STORAGE } from "@starci/object-storage"
import { createMemoryObjectStorage } from "@starci/object-storage/testing"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StorageObjectsService } from "./object-storage-objects.service"
import { STORAGE_OPTIONS } from "./object-storage.decorators"
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
    const storage = createMemoryObjectStorage({ publicEndpoint: options.publicUrl })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            StorageObjectsService,
            { provide: OBJECT_STORAGE, useValue: storage },
            { provide: STORAGE_OPTIONS, useValue: options },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { storage, logger, service: moduleRef.get(StorageObjectsService) }
}

describe("StorageObjectsService / uploads", () => {
    it("signs an upload under the environment bucket for the content type with the upload TTL and no token", async () => {
        const { storage, service } = await build()

        const signed = await service.signedUpload("media", "ws/a.png", "image/png")

        expect(signed).toMatchObject({ kind: "ok", value: { path: "ws/a.png", token: "" } })
        expect(storage.store.signed).toEqual([
            expect.objectContaining({
                method: "PUT",
                bucket: "nivo-media",
                key: "ws/a.png",
                contentType: "image/png",
                expiresIn: UPLOAD_URL_SECONDS,
            }),
        ])
    })

    it("lets the browser store the object only with the content type the address was signed for", async () => {
        const { storage, service } = await build()
        const signed = await service.signedUpload("media", "ws/a.png", "image/png")
        const url = signed.kind === "ok" ? signed.value.signedUrl : ""

        await expect(storage.upload(url, new Uint8Array([1]), "text/plain")).resolves.toBe(403)
        await expect(storage.upload(url, new Uint8Array([1]), "image/png")).resolves.toBe(200)
        await expect(service.sizeOf("media", "ws/a.png")).resolves.toEqual({ kind: "ok", value: 1 })
    })

    it("says NOT_FOUND for a path that is not a key and UNAVAILABLE when the signer fails", async () => {
        const { storage, service } = await build()

        await expect(service.signedUpload("media", "../a.png", "image/png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        jest.spyOn(storage, "presignPut").mockRejectedValueOnce(new Error("no keys"))
        await expect(service.signedUpload("media", "ws/a.png", "image/png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })
})

describe("StorageObjectsService / signed reads", () => {
    it("signs reads for the asked TTL, clamped to the longest the signature allows, and omits missing objects", async () => {
        const { storage, service } = await build()
        storage.seed("nivo-hiring", "cv/there.pdf", "x", "application/pdf")

        const signed = await service.signedUrls("hiring", ["cv/there.pdf", "cv/gone.pdf"], MAX_PRESIGN_SECONDS * 3)

        expect(signed).toMatchObject({ kind: "ok", value: [{ path: "cv/there.pdf" }] })
        expect(storage.store.signed).toEqual([
            expect.objectContaining({
                method: "GET",
                bucket: "nivo-hiring",
                key: "cv/there.pdf",
                expiresIn: MAX_PRESIGN_SECONDS,
            }),
        ])
    })

    it("answers nothing for no paths", async () => {
        const { service } = await build()

        await expect(service.signedUrls("media", [], 60)).resolves.toEqual({ kind: "ok", value: [] })
        await expect(service.remove("media", [])).resolves.toEqual({ kind: "ok", value: 0 })
    })
})

describe("StorageObjectsService / reads", () => {
    it("downloads the bytes and says NOT_FOUND for an object that is not there or a key that is not valid", async () => {
        const { storage, service } = await build()
        storage.seed("nivo-knowledge-uploads", "ws/u/doc.txt", new Uint8Array([7]), "text/plain")

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
        const { storage, logger, service } = await build()
        storage.store.down = true

        await expect(service.download("media", "ws/a.png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("lists a folder with the time the store recorded", async () => {
        const { storage, service } = await build()
        storage.seed("nivo-media", "ws/a.png", new Uint8Array([1]), "image/png")

        await expect(service.list("media", "ws", 10)).resolves.toEqual({
            kind: "ok",
            value: [{ name: "a.png", createdAt: expect.any(String) }],
        })
    })

    it("answers the size of an object without reading it, NOT_FOUND when it is not there and UNAVAILABLE when the store fails", async () => {
        const { storage, service } = await build()
        storage.seed("nivo-knowledge-uploads", "ws/u/doc.txt", new Uint8Array([7, 8, 9]), "text/plain")

        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({ kind: "ok", value: 3 })
        await expect(service.sizeOf("knowledge-uploads", "ws/u/none.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        storage.store.down = true
        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })
})

describe("StorageObjectsService / removal and addresses", () => {
    it("removes objects and counts only those that existed", async () => {
        const { storage, service } = await build()
        storage.seed("nivo-media", "ws/a.png", new Uint8Array([1]), "image/png")

        await expect(service.remove("media", ["ws/a.png", "ws/b.png"])).resolves.toEqual({ kind: "ok", value: 1 })
    })

    it("says UNAVAILABLE when removal fails", async () => {
        const { storage, service } = await build()
        storage.store.down = true

        await expect(service.remove("media", ["ws/a.png"])).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })

    it("builds the public address of a public bucket object from the public origin", async () => {
        const { service } = await build()

        expect(service.publicUrl("avatars_public", "people/1.png")).toBe(
            "https://minio.example.org/nivo-avatars-public/people/1.png",
        )
    })
})
