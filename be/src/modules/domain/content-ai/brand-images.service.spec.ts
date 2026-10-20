import { mkdtemp, readdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { FFMPEG } from "@modules/integrations/ffmpeg"
import type { Ffmpeg } from "@modules/integrations/ffmpeg"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { BrandImagesService, MEDIA_BUCKET } from "./brand-images.service"
import { CONTENT_AI_OPTIONS, MARKETING_ASSETS } from "./content-agent.decorators"
import type { MarketingAssets } from "./content-agent.port"

const COPIES = [
    { headline: "Khoang lang cuoi tuan", subline: "-20%" },
    { headline: "Cham den an yen", subline: "Spa cuoi tuan" },
    { headline: "Third", subline: "" },
]

const build = async () => {
    const workDir = await mkdtemp(join(tmpdir(), "marketing-spec-"))
    const objects = mock<SupabaseObjectsPort>()
    const assets = mock<MarketingAssets>()
    const ffmpeg = mock<Ffmpeg>()
    ffmpeg.run.mockImplementation(async (_tool, args, run) => {
        await writeFile(join(run.cwd, String(args[args.length - 1])), "png")
        return { stdout: "", stderr: "" }
    })
    assets.upload.mockResolvedValue({ error: null })
    objects.download.mockResolvedValue({ kind: "ok", value: { bytes: new Uint8Array([1]), contentType: "image/png" } })
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrandImagesService,
            { provide: CONTENT_AI_OPTIONS, useValue: { assets: MARKETING_ASSETS, fontsDir: "/fonts", workDir } },
            { provide: SUPABASE_OBJECTS, useValue: objects },
            { provide: MARKETING_ASSETS, useValue: assets },
            { provide: FFMPEG, useValue: ffmpeg },
        ],
    }).compile()
    return { service: moduleRef.get(BrandImagesService), objects, assets, ffmpeg, workDir }
}

describe("BrandImagesService compose", () => {
    it("composes two images over library photos with the logo, stores them and cleans the work directory", async () => {
        const { service, objects, assets, ffmpeg, workDir } = await build()
        objects.list.mockResolvedValue({
            kind: "ok",
            value: [
                { name: "spa.jpg", createdAt: null },
                { name: "notes.txt", createdAt: null },
                { name: "room.png", createdAt: null },
            ],
        })

        const images = await service.compose({
            workspaceId: "ws-1",
            key: "k1",
            copies: COPIES,
            kit: null,
            logoPath: "ws-1/logo.png",
        })

        expect(images).toEqual([
            { path: "ws-1/marketing/k1-1.png", width: 1200, height: 800 },
            { path: "ws-1/marketing/k1-2.png", width: 1200, height: 800 },
        ])
        expect(objects.download).toHaveBeenCalledWith(MEDIA_BUCKET, "ws-1/spa.jpg")
        expect(objects.download).toHaveBeenCalledWith(MEDIA_BUCKET, "ws-1/room.png")
        expect(objects.download).toHaveBeenCalledWith(MEDIA_BUCKET, "ws-1/logo.png")
        expect(ffmpeg.run).toHaveBeenCalledTimes(2)
        expect(ffmpeg.run.mock.calls[0]?.[1]).toEqual(expect.arrayContaining(["photo-0", "logo"]))
        expect(ffmpeg.run.mock.calls[1]?.[1]).toEqual(expect.arrayContaining(["photo-1"]))
        expect(assets.upload).toHaveBeenCalledWith(
            MEDIA_BUCKET,
            "ws-1/marketing/k1-1.png",
            expect.any(Buffer),
            "image/png",
        )
        await expect(readdir(workDir)).resolves.toEqual([])
    })

    it("uses the plain canvas when the library is unavailable, a photo is gone and there is no logo", async () => {
        const { service, objects, ffmpeg } = await build()
        objects.list.mockResolvedValueOnce({ kind: "refused", code: "SUPABASE_PROVIDER_UNAVAILABLE" })

        await service.compose({ workspaceId: "ws-1", key: "k2", copies: COPIES.slice(0, 1), kit: null, logoPath: null })

        expect(ffmpeg.run.mock.calls[0]?.[1]).not.toContain("logo")
        objects.list.mockResolvedValueOnce({ kind: "ok", value: [{ name: "a.jpg", createdAt: null }] })
        objects.download.mockResolvedValueOnce({ kind: "refused", code: "SUPABASE_OBJECT_NOT_FOUND" })
        await service.compose({ workspaceId: "ws-1", key: "k3", copies: COPIES.slice(0, 1), kit: null, logoPath: null })
        expect(ffmpeg.run.mock.calls[1]?.[1]).not.toContain("photo-0")
    })

    it("fails with the storage error and still cleans up", async () => {
        const { service, objects, assets, workDir } = await build()
        objects.list.mockResolvedValue({ kind: "ok", value: [] })
        assets.upload.mockResolvedValue({ error: new Error("full") })

        await expect(
            service.compose({ workspaceId: "ws-1", key: "k4", copies: COPIES, kit: null, logoPath: null }),
        ).rejects.toThrow("full")
        await expect(readdir(workDir)).resolves.toEqual([])
    })
})

describe("BrandImagesService urlsOf", () => {
    it("signs the paths in order, leaving out missing ones", async () => {
        const { service, objects } = await build()
        objects.signedUrls.mockResolvedValue({
            kind: "ok",
            value: [
                { path: "b", signedUrl: "https://s/b" },
                { path: "a", signedUrl: "https://s/a" },
            ],
        })

        await expect(service.urlsOf(["a", "b", "c"])).resolves.toEqual(["https://s/a", "https://s/b"])
    })

    it("answers none for no paths and when signing is refused", async () => {
        const { service, objects } = await build()
        objects.signedUrls.mockResolvedValue({ kind: "refused", code: "SUPABASE_PROVIDER_UNAVAILABLE" })

        await expect(service.urlsOf([])).resolves.toEqual([])
        await expect(service.urlsOf(["a"])).resolves.toEqual([])
    })
})
