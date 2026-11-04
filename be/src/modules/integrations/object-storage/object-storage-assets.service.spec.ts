import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { OBJECT_STORAGE } from "@starci/object-storage"
import type { ObjectStorage } from "@starci/object-storage"
import { Secret } from "@modules/platform/config"
import { ObjectStorageError, ObjectStorageErrorCode } from "./errors/object-storage.error"
import { StorageAssetsService } from "./object-storage-assets.service"
import { STORAGE_OPTIONS } from "./object-storage.decorators"
import type { ObjectStorageOptions } from "./object-storage.options"

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
    const storage = mock<ObjectStorage>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            StorageAssetsService,
            { provide: OBJECT_STORAGE, useValue: storage },
            { provide: STORAGE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { storage, service: moduleRef.get(StorageAssetsService) }
}

describe("StorageAssetsService", () => {
    it("writes a file under the environment bucket and reads it back as a Blob", async () => {
        const { storage, service } = await build()
        storage.get.mockResolvedValueOnce({ bytes: new Uint8Array([1, 2, 3]), contentType: "video/mp4" })

        await expect(service.upload("videos", "ws/a.mp4", Buffer.from("xyz"), "video/mp4")).resolves.toEqual({
            error: null,
        })
        const read = await service.download("videos", "ws/a.mp4")

        expect(storage.put).toHaveBeenCalledWith("nivo-videos", "ws/a.mp4", Buffer.from("xyz"), "video/mp4")
        expect(storage.get).toHaveBeenCalledWith("nivo-videos", "ws/a.mp4")
        expect(read.error).toBeNull()
        expect(read.data?.size).toBe(3)
        expect(read.data?.type).toBe("video/mp4")
    })

    it("answers an error value for a file that is not there", async () => {
        const { storage, service } = await build()
        storage.get.mockResolvedValueOnce(null)

        const read = await service.download("media", "ws/none.mp3")

        expect(read.data).toBeNull()
        expect(read.error).toBeInstanceOf(ObjectStorageError)
        expect(read.error).toMatchObject({ code: ObjectStorageErrorCode.ObjectNotFound })
    })

    it("answers an error value when the store fails on write", async () => {
        const { storage, service } = await build()
        storage.put.mockRejectedValueOnce(new Error("down"))

        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(written.error?.message).toBe("down")
    })

    it("answers the error value when the store fails on read", async () => {
        const { storage, service } = await build()
        storage.get.mockRejectedValueOnce(new Error("down"))

        const read = await service.download("media", "ws/a.png")

        expect(read.error?.message).toBe("down")
    })

    it("turns a failure that is not an Error into an Error value", async () => {
        const { storage, service } = await build()
        storage.get.mockRejectedValueOnce("plain text")
        storage.put.mockRejectedValueOnce("plain text")

        const read = await service.download("media", "ws/a.png")
        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(read.error?.message).toBe("storage failure")
        expect(written.error?.message).toBe("storage failure")
    })
})
