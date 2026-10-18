import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { SUPABASE_OBJECTS } from "@modules/integrations/supabase"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import { VideoErrorCode } from "./errors/video.error"
import type { WorkbenchRenderRow } from "./persistence/video-workbench.rows"
import { SELECT_VIDEO_MEDIA_ID } from "./persistence/video-media.sql"
import { VideoMediaService } from "./video-media.service"

const WS = "workspace-1"
const UPLOAD_ID = "00000000-0000-4000-8000-000000000001"

const DONE: WorkbenchRenderRow = {
    id: "render-1",
    status: "done",
    progress: 100,
    stage: null,
    duration_ms: 15_000,
    size_bytes: 2048,
    output_path: `${WS}/render-1/video.mp4`,
    poster_path: `${WS}/render-1/poster.jpg`,
}

const signedOf = (paths: ReadonlyArray<string>) =>
    ok(paths.map((path) => ({ path, signedUrl: `https://cdn/${path}?token=1` })))

const build = async (em: MockEntityManager) => {
    const storage = mock<SupabaseObjectsPort>()
    storage.signedUrls.mockImplementation((_bucket, paths) => Promise.resolve(signedOf(paths)))
    const members = mock<WorkspaceMembersService>()
    const entitlements = mock<EntitlementsService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            VideoMediaService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: SUPABASE_OBJECTS, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return { media: moduleRef.get(VideoMediaService), storage, members, entitlements, em }
}

describe("VideoMediaService", () => {
    describe("list", () => {
        it("answers the member's images and clips with preview links and readable names", async () => {
            const { media, storage, members } = await build(mockEntityManager({}))
            storage.list.mockResolvedValue(
                ok([
                    { name: `${UPLOAD_ID}-cake.jpg`, createdAt: null },
                    { name: "notes.txt", createdAt: null },
                    { name: "clip.MP4", createdAt: null },
                ]),
            )

            await expect(media.list("person-1", WS)).resolves.toEqual([
                {
                    path: `${WS}/${UPLOAD_ID}-cake.jpg`,
                    name: "cake.jpg",
                    kind: "image",
                    url: `https://cdn/${WS}/${UPLOAD_ID}-cake.jpg?token=1`,
                },
                { path: `${WS}/clip.MP4`, name: "clip.MP4", kind: "video", url: `https://cdn/${WS}/clip.MP4?token=1` },
            ])
            expect(members.require).toHaveBeenCalledWith("person-1", WS)
            expect(storage.list).toHaveBeenCalledWith("media", WS, 60)
            expect(storage.signedUrls).toHaveBeenCalledWith(
                "media",
                [`${WS}/${UPLOAD_ID}-cake.jpg`, `${WS}/clip.MP4`],
                3600,
            )
        })

        it("signs nothing for an empty folder", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            storage.list.mockResolvedValue(ok([]))

            await expect(media.list("person-1", WS)).resolves.toEqual([])
            expect(storage.signedUrls).not.toHaveBeenCalled()
        })

        it("fails when the folder cannot be listed", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            storage.list.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

            await expect(media.list("person-1", WS)).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
                params: { path: WS },
            })
        })

        it("retains a listed file without a preview when storage returns no link", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            storage.list.mockResolvedValue(ok([{ name: "cake.png", createdAt: null }]))
            storage.signedUrls.mockResolvedValue(ok([]))

            await expect(media.list("person-1", WS)).resolves.toEqual([
                { path: `${WS}/cake.png`, name: "cake.png", kind: "image", url: null },
            ])
            expect(storage.signedUrls).toHaveBeenCalledWith("media", [`${WS}/cake.png`], 3600)
        })
    })
})

describe("VideoMediaService", () => {
    describe("createUpload", () => {
        const file = { name: "B\u00e1nh m\u00ec ngon!.JPG", type: "image/jpeg", size: 1000 }

        it("gives a manager a ticket for a sanitized path inside the workspace", async () => {
            const em = mockEntityManager({ query: [SELECT_VIDEO_MEDIA_ID, [{ id: UPLOAD_ID }]] })
            const { media, storage, members, entitlements } = await build(em)
            const path = `${WS}/${UPLOAD_ID}-Banh-mi-ngon-.JPG`
            storage.signedUpload.mockResolvedValue(ok({ path, token: "token-1", signedUrl: "https://up/1" }))

            await expect(media.createUpload("person-1", WS, file)).resolves.toEqual({
                path,
                token: "token-1",
                signedUrl: "https://up/1",
            })
            expect(members.require).toHaveBeenCalledWith("person-1", WS, ["owner", "manager"])
            expect(entitlements.requireStorageFor).toHaveBeenCalledWith(WS, 1000)
            expect(storage.signedUpload).toHaveBeenCalledWith("media", path)
        })

        it.each([
            ["an unsupported type", { ...file, type: "application/pdf" }],
            ["an empty file", { ...file, size: 0 }],
            ["a file over the limit", { ...file, size: 50 * 1024 * 1024 + 1 }],
        ])("refuses %s before checking the quota", async (_label, refusedFile) => {
            const { media, entitlements } = await build(mockEntityManager({}))

            await expect(media.createUpload("person-1", WS, refusedFile)).rejects.toMatchObject({
                code: VideoErrorCode.InputInvalid,
            })
            expect(entitlements.requireStorageFor).not.toHaveBeenCalled()
        })

        it("names a file with no usable characters 'file'", async () => {
            const em = mockEntityManager({ query: [SELECT_VIDEO_MEDIA_ID, [{ id: UPLOAD_ID }]] })
            const { media, storage } = await build(em)
            storage.signedUpload.mockResolvedValue(ok({ path: "p", token: "t", signedUrl: "u" }))

            await media.createUpload("person-1", WS, { ...file, name: "..." })

            expect(storage.signedUpload).toHaveBeenCalledWith("media", `${WS}/${UPLOAD_ID}-file`)
        })

        it("fails when no upload identity is generated", async () => {
            const em = mockEntityManager({ query: [SELECT_VIDEO_MEDIA_ID, []] })
            const { media } = await build(em)

            await expect(media.createUpload("person-1", WS, file)).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
                params: { path: WS },
            })
        })

        it("fails when storage refuses the upload address", async () => {
            const em = mockEntityManager({ query: [SELECT_VIDEO_MEDIA_ID, [{ id: UPLOAD_ID }]] })
            const { media, storage } = await build(em)
            storage.signedUpload.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

            await expect(media.createUpload("person-1", WS, file)).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
                params: { path: `${WS}/${UPLOAD_ID}-Banh-mi-ngon-.JPG` },
            })
        })
    })
})

describe("VideoMediaService", () => {
    describe("render", () => {
        it("signs only workspace-local caption artifacts and preserves unknown language", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            const path = `${WS}/render-1/captions.vtt`

            expect(
                await media.render({ ...DONE, captions_path: path, captions_lang: "vi-VN" }, WS, "Video"),
            ).toMatchObject({ captionsUrl: `https://cdn/${path}?token=1`, captionsLang: "vi-VN" })
            expect(storage.signedUrls).toHaveBeenCalledWith("videos", [DONE.output_path, DONE.poster_path, path], 3600)
            expect(await media.render({ ...DONE, captions_path: path }, WS, "Video")).toMatchObject({
                captionsUrl: `https://cdn/${path}?token=1`,
                captionsLang: null,
            })
            expect(
                await media.render(
                    { ...DONE, captions_path: "other/captions.vtt", captions_lang: "vi-VN" },
                    WS,
                    "Video",
                ),
            ).toMatchObject({ captionsUrl: null, captionsLang: null })
            expect(storage.signedUrls).toHaveBeenLastCalledWith("videos", [DONE.output_path, DONE.poster_path], 3600)
            expect(
                await media.render(
                    { ...DONE, status: "failed", captions_path: path, captions_lang: "vi-VN" },
                    WS,
                    "Video",
                ),
            ).toMatchObject({ captionsUrl: null, captionsLang: null })
        })
    })
})

describe("VideoMediaService", () => {
    describe("render", () => {
        it("answers nothing before the first render", async () => {
            const { media } = await build(mockEntityManager({}))

            await expect(media.render(null, WS, "Spring")).resolves.toBeNull()
        })

        it("adds playback, download and poster links to a finished render", async () => {
            const { media, storage } = await build(mockEntityManager({}))

            await expect(media.render(DONE, WS, "B\u00e1nh m\u00ec: sale!")).resolves.toEqual({
                id: "render-1",
                status: "done",
                progress: 100,
                stage: null,
                durationMs: 15_000,
                sizeBytes: 2048,
                errorCode: null,
                videoUrl: `https://cdn/${WS}/render-1/video.mp4?token=1`,
                captionsUrl: null,
                captionsLang: null,
                downloadUrl: `https://cdn/${WS}/render-1/video.mp4?token=1&download=Banh-mi-sale-.mp4`,
                posterUrl: `https://cdn/${WS}/render-1/poster.jpg?token=1`,
            })
            expect(storage.signedUrls).toHaveBeenCalledWith("videos", [DONE.output_path, DONE.poster_path], 3600)
        })

        it("signs no path outside the workspace", async () => {
            const { media, storage } = await build(mockEntityManager({}))

            const render = await media.render({ ...DONE, output_path: "other/video.mp4", poster_path: null }, WS, "")

            expect(render).toMatchObject({ videoUrl: null, downloadUrl: null, posterUrl: null })
            expect(storage.signedUrls).not.toHaveBeenCalled()
        })

        it("reports a failed render with a stable code and no links", async () => {
            const { media } = await build(mockEntityManager({}))

            await expect(media.render({ ...DONE, status: "failed" }, WS, "x")).resolves.toMatchObject({
                errorCode: "VIDEO_RENDER_FAILED",
                videoUrl: null,
                posterUrl: null,
            })
        })

        it("links a completed poster even when no video output was stored", async () => {
            const { media, storage } = await build(mockEntityManager({}))

            await expect(media.render({ ...DONE, output_path: null }, WS, "Poster")).resolves.toEqual({
                id: "render-1",
                status: "done",
                progress: 100,
                stage: null,
                durationMs: 15_000,
                sizeBytes: 2048,
                errorCode: null,
                videoUrl: null,
                captionsUrl: null,
                captionsLang: null,
                downloadUrl: null,
                posterUrl: `https://cdn/${WS}/render-1/poster.jpg?token=1`,
            })
            expect(storage.signedUrls).toHaveBeenCalledWith("videos", [DONE.poster_path], 3600)
        })
    })
})

describe("VideoMediaService", () => {
    describe("shareLink", () => {
        it("answers a three day link for a workspace video", async () => {
            const { media, storage } = await build(mockEntityManager({}))

            await expect(media.shareLink(WS, `${WS}/r/video.mp4`)).resolves.toBe(
                `https://cdn/${WS}/r/video.mp4?token=1`,
            )
            expect(storage.signedUrls).toHaveBeenCalledWith("videos", [`${WS}/r/video.mp4`], 259_200)
        })

        it("refuses a path outside the workspace", async () => {
            const { media } = await build(mockEntityManager({}))

            await expect(media.shareLink(WS, `${WS}/../other/video.mp4`)).rejects.toMatchObject({
                code: VideoErrorCode.InputInvalid,
            })
        })

        it("fails when the object is missing", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            storage.signedUrls.mockResolvedValue(ok([]))

            await expect(media.shareLink(WS, `${WS}/r/video.mp4`)).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
                params: { path: `${WS}/r/video.mp4` },
            })
        })

        it("fails when storage cannot sign", async () => {
            const { media, storage } = await build(mockEntityManager({}))
            storage.signedUrls.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

            await expect(media.shareLink(WS, `${WS}/r/video.mp4`)).rejects.toMatchObject({
                code: VideoErrorCode.StorageFailed,
                params: { path: "videos" },
            })
        })
    })
})
