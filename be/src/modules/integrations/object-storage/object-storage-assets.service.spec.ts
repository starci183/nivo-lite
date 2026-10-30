import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { Secret } from "@modules/platform/config"
import { fakeStorage } from "@tests/fixtures/doubles/fake-storage.client"
import type { StorageClient } from "./object-storage.contracts"
import { StorageAssetsService } from "./object-storage-assets.service"
import { STORAGE_CLIENT, STORAGE_OPTIONS } from "./storage.decorators"
import type { ObjectStorageOptions } from "./storage.options"

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
    const { objects } = fakeStorage(client)
    const moduleRef = await Test.createTestingModule({
        providers: [
            StorageAssetsService,
            { provide: STORAGE_CLIENT, useValue: client },
            { provide: STORAGE_OPTIONS, useValue: options },
        ],
    }).compile()
    return { client, objects, service: moduleRef.get(StorageAssetsService) }
}

describe("StorageAssetsService", () => {
    it("writes a file under the environment bucket and reads it back as a Blob", async () => {
        const { objects, service } = await build()

        await expect(service.upload("videos", "ws/a.mp4", Buffer.from("xyz"), "video/mp4")).resolves.toEqual({
            error: null,
        })
        const read = await service.download("videos", "ws/a.mp4")

        expect(objects.has("nivo-videos/ws/a.mp4")).toBe(true)
        expect(read.error).toBeNull()
        expect(read.data?.size).toBe(3)
        expect(read.data?.type).toBe("video/mp4")
    })

    it("answers an error value for a file that is not there", async () => {
        const { service } = await build()

        const read = await service.download("media", "ws/none.mp3")

        expect(read.data).toBeNull()
        expect(read.error).toMatchObject({ code: "OBJECT_STORAGE_NOT_FOUND" })
    })

    it("answers an error value when the store fails on write", async () => {
        const { client, service } = await build()
        client.put.mockRejectedValueOnce(new Error("down"))

        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(written.error?.message).toBe("down")
    })

    it("answers the error value when the store fails on read", async () => {
        const { client, service } = await build()
        client.get.mockRejectedValueOnce(new Error("down"))

        const read = await service.download("media", "ws/a.png")

        expect(read.error?.message).toBe("down")
    })

    it("turns a failure that is not an Error into an Error value", async () => {
        const { client, service } = await build()
        client.get.mockRejectedValueOnce("plain text")
        client.put.mockRejectedValueOnce("plain text")

        const read = await service.download("media", "ws/a.png")
        const written = await service.upload("media", "ws/a.png", Buffer.from("x"), "image/png")

        expect(read.error?.message).toBe("storage failure")
        expect(written.error?.message).toBe("storage failure")
    })
})
