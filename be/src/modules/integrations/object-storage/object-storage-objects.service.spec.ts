import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OBJECT_STORAGE, OBJECT_STORAGE_ERROR_CODES, ObjectStorageError } from "@starci/object-storage"
import type { ObjectHead, ObjectStorage, PresignedRequest } from "@starci/object-storage"
import { Secret } from "@modules/platform/config"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { StorageObjectsService } from "./object-storage-objects.service"
import { STORAGE_OPTIONS } from "./object-storage.decorators"
import { StorageLogEvent } from "./object-storage.log-events"
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

const signedBy = (url: string, method: "GET" | "PUT"): PresignedRequest => ({
    method,
    url,
    headers: {},
    expiresIn: 60,
    expiresAt: "2026-11-04T00:01:00.000Z",
})

const headOf = (size: number): ObjectHead => ({
    size,
    contentType: "application/pdf",
    lastModified: "2026-11-04T00:00:00.000Z",
    etag: null,
})

const keyInvalid = (): ObjectStorageError => new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.KeyInvalid)

const build = async () => {
    const storage = mock<ObjectStorage>()
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
        storage.presignPut.mockResolvedValueOnce(signedBy("https://minio.example.org/nivo-media/ws/a.png?sig=1", "PUT"))

        const signed = await service.signedUpload("media", "ws/a.png", "image/png")

        expect(signed).toEqual({
            kind: "ok",
            value: { path: "ws/a.png", token: "", signedUrl: "https://minio.example.org/nivo-media/ws/a.png?sig=1" },
        })
        expect(storage.presignPut).toHaveBeenCalledWith("nivo-media", "ws/a.png", {
            contentType: "image/png",
            expiresIn: UPLOAD_URL_SECONDS,
        })
    })

    it("says NOT_FOUND for a path that is not a key and UNAVAILABLE when the signer fails", async () => {
        const { storage, logger, service } = await build()
        storage.presignPut.mockRejectedValueOnce(keyInvalid())
        storage.presignPut.mockRejectedValueOnce(new Error("no keys"))

        await expect(service.signedUpload("media", "../a.png", "image/png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        expect(logger.error).not.toHaveBeenCalled()
        await expect(service.signedUpload("media", "ws/a.png", "image/png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("says UNAVAILABLE and logs it when the store itself reports it cannot be reached", async () => {
        const { storage, logger, service } = await build()
        const unreachable = new ObjectStorageError(OBJECT_STORAGE_ERROR_CODES.Unavailable)
        storage.presignPut.mockRejectedValueOnce(unreachable)

        await expect(service.signedUpload("media", "ws/a.png", "image/png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(logger.error).toHaveBeenCalledWith(StorageLogEvent.Failed, unreachable, { bucket: "media" })
    })
})

describe("StorageObjectsService / signed reads", () => {
    it("signs reads for the asked TTL, clamped to the longest the signature allows, and omits missing objects", async () => {
        const { storage, service } = await build()
        storage.head.mockImplementation((_bucket, key) => Promise.resolve(key === "cv/there.pdf" ? headOf(1) : null))
        storage.presignGet.mockResolvedValueOnce(
            signedBy("https://minio.example.org/nivo-media/cv/there.pdf?sig=2", "GET"),
        )

        const signed = await service.signedUrls("media", ["cv/there.pdf", "cv/gone.pdf"], MAX_PRESIGN_SECONDS * 3)

        expect(signed).toEqual({
            kind: "ok",
            value: [{ path: "cv/there.pdf", signedUrl: "https://minio.example.org/nivo-media/cv/there.pdf?sig=2" }],
        })
        expect(storage.presignGet).toHaveBeenCalledTimes(1)
        expect(storage.presignGet).toHaveBeenCalledWith("nivo-media", "cv/there.pdf", {
            expiresIn: MAX_PRESIGN_SECONDS,
        })
    })

    it("answers nothing for no paths", async () => {
        const { storage, service } = await build()

        await expect(service.signedUrls("media", [], 60)).resolves.toEqual({ kind: "ok", value: [] })
        await expect(service.remove("media", [])).resolves.toEqual({ kind: "ok", value: 0 })
        expect(storage.head).not.toHaveBeenCalled()
        expect(storage.removeMany).not.toHaveBeenCalled()
    })
})

describe("StorageObjectsService / reads", () => {
    it("downloads the bytes and says NOT_FOUND for an object that is not there or a key that is not valid", async () => {
        const { storage, service } = await build()
        storage.get.mockResolvedValueOnce({ bytes: new Uint8Array([7]), contentType: "text/plain" })
        storage.get.mockResolvedValueOnce(null)
        storage.get.mockRejectedValueOnce(keyInvalid())

        await expect(service.download("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({
            kind: "ok",
            value: { bytes: new Uint8Array([7]), contentType: "text/plain" },
        })
        expect(storage.get).toHaveBeenCalledWith("nivo-knowledge-uploads", "ws/u/doc.txt")
        await expect(service.download("knowledge-uploads", "ws/u/none.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        await expect(service.download("knowledge-uploads", "../x")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
    })

    it("says NOT_FOUND for a purpose that names no valid bucket without asking the store", async () => {
        const { storage, service } = await build()

        await expect(service.download("Bad Purpose!", "ws/a.png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        expect(storage.get).not.toHaveBeenCalled()
    })

    it("logs and answers UNAVAILABLE when the store fails", async () => {
        const { storage, logger, service } = await build()
        storage.get.mockRejectedValueOnce(new Error("down"))

        await expect(service.download("media", "ws/a.png")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("lists a folder with the time the store recorded", async () => {
        const { storage, service } = await build()
        storage.list.mockResolvedValueOnce([{ name: "a.png", lastModified: "2026-11-04T00:00:00.000Z" }])

        await expect(service.list("media", "ws", 10)).resolves.toEqual({
            kind: "ok",
            value: [{ name: "a.png", createdAt: "2026-11-04T00:00:00.000Z" }],
        })
        expect(storage.list).toHaveBeenCalledWith("nivo-media", "ws", 10)
    })

    it("answers the size of an object without reading it, NOT_FOUND when it is not there and UNAVAILABLE when the store fails", async () => {
        const { storage, service } = await build()
        storage.head.mockResolvedValueOnce(headOf(3))
        storage.head.mockResolvedValueOnce(null)
        storage.head.mockRejectedValueOnce(new Error("down"))

        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({ kind: "ok", value: 3 })
        await expect(service.sizeOf("knowledge-uploads", "ws/u/none.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_NOT_FOUND",
        })
        await expect(service.sizeOf("knowledge-uploads", "ws/u/doc.txt")).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
        expect(storage.get).not.toHaveBeenCalled()
    })
})

describe("StorageObjectsService / removal and addresses", () => {
    it("removes objects and counts only those that existed", async () => {
        const { storage, service } = await build()
        storage.removeMany.mockResolvedValueOnce(1)

        await expect(service.remove("media", ["ws/a.png", "ws/b.png"])).resolves.toEqual({ kind: "ok", value: 1 })
        expect(storage.removeMany).toHaveBeenCalledWith("nivo-media", ["ws/a.png", "ws/b.png"])
    })

    it("says UNAVAILABLE when removal fails", async () => {
        const { storage, service } = await build()
        storage.removeMany.mockRejectedValueOnce(new Error("down"))

        await expect(service.remove("media", ["ws/a.png"])).resolves.toEqual({
            kind: "refused",
            code: "OBJECT_STORAGE_UNAVAILABLE",
        })
    })

    it("builds the public address of a public bucket object from the public origin", async () => {
        const { storage, service } = await build()
        storage.publicUrl.mockReturnValueOnce("https://minio.example.org/nivo-avatars-public/people/1.png")

        expect(service.publicUrl("avatars_public", "people/1.png")).toBe(
            "https://minio.example.org/nivo-avatars-public/people/1.png",
        )
        expect(storage.publicUrl).toHaveBeenCalledWith("nivo-avatars-public", "people/1.png")
    })
})
