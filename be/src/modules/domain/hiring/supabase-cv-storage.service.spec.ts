import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { ok, refused } from "@modules/platform/primitives"
import { SupabaseCvStorageService } from "./supabase-cv-storage.service"

const build = async () => {
    const objects = mock<SupabaseObjectsPort>()
    const moduleRef = await Test.createTestingModule({
        providers: [SupabaseCvStorageService, { provide: SUPABASE_OBJECTS, useValue: objects }],
    }).compile()
    return { objects, storage: moduleRef.get(SupabaseCvStorageService) }
}

describe("SupabaseCvStorageService", () => {
    it("signs a ten-minute view link in the hiring bucket", async () => {
        const { objects, storage } = await build()
        objects.signedUrls.mockResolvedValue(ok([{ path: "ws/a.pdf", signedUrl: "https://s/a" }]))

        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBe("https://s/a")
        expect(objects.signedUrls).toHaveBeenCalledWith("hiring", ["ws/a.pdf"], 600)
    })

    it("has no link for a missing file or a Storage failure", async () => {
        const { objects, storage } = await build()
        objects.signedUrls.mockResolvedValueOnce(ok([]))
        objects.signedUrls.mockResolvedValueOnce(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBeNull()
        await expect(storage.signedUrl("ws/a.pdf")).resolves.toBeNull()
    })

    it("answers the upload token, or null when Storage refuses", async () => {
        const { objects, storage } = await build()
        objects.signedUpload.mockResolvedValueOnce(ok({ path: "p", token: "t", signedUrl: "u" }))
        objects.signedUpload.mockResolvedValueOnce(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(storage.signedUpload("p")).resolves.toBe("t")
        await expect(storage.signedUpload("p")).resolves.toBeNull()
        expect(objects.signedUpload).toHaveBeenCalledWith("hiring", "p")
    })

    it("counts the removed files, none on a Storage failure", async () => {
        const { objects, storage } = await build()
        objects.remove.mockResolvedValueOnce(ok(2))
        objects.remove.mockResolvedValueOnce(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(storage.remove(["a", "b"])).resolves.toBe(2)
        await expect(storage.remove(["a"])).resolves.toBe(0)
        expect(objects.remove).toHaveBeenCalledWith("hiring", ["a", "b"])
    })
})
