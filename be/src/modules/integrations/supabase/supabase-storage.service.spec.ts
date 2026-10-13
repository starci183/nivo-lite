import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { SupabaseAdminClient } from "./supabase.client"
import { SUPABASE_ADMIN_CLIENT } from "./supabase.decorators"
import { SupabaseStorageService } from "./supabase-storage.service"

type Bucket = ReturnType<SupabaseAdminClient["storage"]["from"]>

const build = async () => {
    const bucket = mock<Bucket>()
    bucket.download.mockResolvedValue({ data: new Blob(["bytes"]), error: null })
    bucket.upload.mockResolvedValue({ data: { id: "1", path: "a/b.mp4", fullPath: "videos/a/b.mp4" }, error: null })
    const storage = mock<SupabaseAdminClient["storage"]>()
    storage.from.mockReturnValue(bucket)
    const admin = mock<SupabaseAdminClient>({ storage })
    const moduleRef = await Test.createTestingModule({
        providers: [SupabaseStorageService, { provide: SUPABASE_ADMIN_CLIENT, useValue: admin }],
    }).compile()
    return { service: moduleRef.get(SupabaseStorageService), storage, bucket }
}

describe("SupabaseStorageService", () => {
    it("reads a file from the named bucket", async () => {
        const { service, storage, bucket } = await build()

        const result = await service.download("media", "ws/a.jpg")

        expect(result.error).toBeNull()
        expect(result.data?.size).toBe(5)
        expect(storage.from.mock.calls).toEqual([["media"]])
        expect(bucket.download.mock.calls).toEqual([["ws/a.jpg"]])
    })

    it("writes a file into the named bucket, replacing an earlier one", async () => {
        const { service, storage, bucket } = await build()
        const body = Buffer.from("video")

        const result = await service.upload("videos", "a/b.mp4", body, "video/mp4")

        expect(result.error).toBeNull()
        expect(storage.from.mock.calls).toEqual([["videos"]])
        expect(bucket.upload.mock.calls).toEqual([["a/b.mp4", body, { contentType: "video/mp4", upsert: true }]])
    })
})
