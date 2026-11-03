import { Test } from "@nestjs/testing"
import { OBJECT_STORAGE } from "@starci/object-storage"
import { createMemoryObjectStorage } from "@starci/object-storage/testing"
import { Secret } from "@modules/platform/config"
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
    const storage = createMemoryObjectStorage()
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

        await expect(service.upload("videos", "ws/a.mp4", Buffer.from("xyz"), "video/mp4")).resolves.toEqual({
            error: null,
        })
        const read = await service.download("videos", "ws/a.mp4")

        expect(storage.store.buckets.get("nivo-videos")?.has("ws/a.mp4")).toBe(true)
        expect(read.error).toBeNull()
        expect(read.data?.size).toBe(3)
        expect(read.data?.type).toBe("video/mp4")
    })

    it("answers an error value for a file that is not there", async () => {
        const { service } = await build()

        const read = await service.download("media", "ws/none.mp3")

        expect(read.data).toBeNull()
        expect(read.error).toMatchObject({ code: "OBJECT_STORAGE_NOT_FOUND", kind: "not-found" })
    })

    it("answers an error value when the store fails on write", async () => {
        const { storage, service } = await build()
        jest.spyOn(storage, "put").mockRejectedValueOnce(new Error("down"))

        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(written.error?.message).toBe("down")
    })

    it("answers the error value when the store fails on read", async () => {
        const { storage, service } = await build()
        jest.spyOn(storage, "get").mockRejectedValueOnce(new Error("down"))

        const read = await service.download("media", "ws/a.png")

        expect(read.error?.message).toBe("down")
    })

    it("turns a failure that is not an Error into an Error value", async () => {
        const { storage, service } = await build()
        jest.spyOn(storage, "get").mockRejectedValueOnce("plain text")
        jest.spyOn(storage, "put").mockRejectedValueOnce("plain text")

        const read = await service.download("media", "ws/a.png")
        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(read.error?.message).toBe("storage failure")
        expect(written.error?.message).toBe("storage failure")
    })
})
