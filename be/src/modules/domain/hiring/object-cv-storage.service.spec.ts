import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { STORAGE_OBJECTS } from "@modules/integrations/object-storage"
import type { StorageObjectsPort } from "@modules/integrations/object-storage"
import { ok, refused } from "@modules/platform/primitives"
import { ObjectCvStorageService } from "./object-cv-storage.service"

const build = async () => {
    const objects = mock<StorageObjectsPort>()
    const moduleRef = await Test.createTestingModule({
        providers: [ObjectCvStorageService, { provide: STORAGE_OBJECTS, useValue: objects }],
    }).compile()
    return { objects, storage: moduleRef.get(ObjectCvStorageService) }
}

describe("ObjectCvStorageService", () => {
    it("signs a ten-minute view link in the hiring bucket", async () => {
        const { objects, storage } = await build()
        objects.signedUrls.mockResolvedValue(ok([{ path: "ws/a.pdf", signedUrl: "https://s/a" }]))

        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBe("https://s/a")
        expect(objects.signedUrls).toHaveBeenCalledWith("hiring", ["ws/a.pdf"], 600)
    })

    it("has no link for a missing file or a Storage failure", async () => {
        const { objects, storage } = await build()
        objects.signedUrls.mockResolvedValueOnce(ok([]))
        objects.signedUrls.mockResolvedValueOnce(refused("OBJECT_STORAGE_UNAVAILABLE"))

        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBeNull()
        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBeNull()
    })

    it("answers the upload token, or null when Storage refuses", async () => {
        const { objects, storage } = await build()
        objects.signedUpload.mockResolvedValueOnce(ok({ path: "p", token: "t", signedUrl: "u" }))
        objects.signedUpload.mockResolvedValueOnce(refused("OBJECT_STORAGE_UNAVAILABLE"))

        await expect(storage.signedUpload("p")).resolves.toBe("t")
        await expect(storage.signedUpload("p")).resolves.toBeNull()
        expect(objects.signedUpload).toHaveBeenCalledWith("hiring", "p")
    })

    it("counts the removed files, none on a Storage failure", async () => {
        const { objects, storage } = await build()
        objects.remove.mockResolvedValueOnce(ok(2))
        objects.remove.mockResolvedValueOnce(refused("OBJECT_STORAGE_UNAVAILABLE"))

        await expect(storage.remove(["a", "b"])).resolves.toBe(2)
        await expect(storage.remove(["a"])).resolves.toBe(0)
        expect(objects.remove).toHaveBeenCalledWith("hiring", ["a", "b"])
    })
})
