import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { EntitlementsService } from "@modules/domain/billing"
import { VideoRendersService } from "@modules/domain/video-renders"
import type { CompletedRenderMedia } from "@modules/domain/video-renders"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { SupabaseObjectsPort } from "@modules/integrations/supabase"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { ok, refused } from "@modules/platform/primitives"
import type { ContentMediaRequest, MediaFile } from "./content-media.contracts"
import { CONTENT_MEDIA_STORAGE } from "./content-media.decorators"
import { ContentMediaService } from "./content-media.service"
import { ContentMediaError, ContentMediaErrorCode } from "./errors/content-media.error"
import { NEW_CONTENT_MEDIA_UPLOAD_ID } from "./persistence/content-media.sql"

const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "Lan",
    status: "active",
}

const STORED_PHOTO = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-photo.png"
const PHOTO_PATH = `ws-1/${STORED_PHOTO}`
const CLIP: CompletedRenderMedia = {
    id: "video-1",
    title: "",
    outputPath: "ws-1/clip.mp4",
    durationMs: null,
    createdAt: "2026-10-03T00:00:00.000Z",
}
const FOREIGN_CLIP: CompletedRenderMedia = {
    id: "video-3",
    title: "Nope",
    outputPath: "other/clip.mp4",
    durationMs: 1,
    createdAt: "2026-10-03T00:00:00.000Z",
}
const PICTURE: MediaFile = { name: "Shop Photo.png", contentType: "image/png", sizeBytes: 1_200 }
const UPLOAD_PATH = "ws-1/upload-1-Shop-Photo.png"

const build = async (entityManager: MockEntityManager = mockEntityManager()) => {
    const storage = mock<SupabaseObjectsPort>()
    const members = mock<WorkspaceMembersService>()
    const renders = mock<VideoRendersService>()
    const entitlements = mock<EntitlementsService>()
    members.require.mockResolvedValue(MEMBER)
    entitlements.requireStorageFor.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [
            ContentMediaService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CONTENT_MEDIA_STORAGE, useValue: storage },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: VideoRendersService, useValue: renders },
            { provide: EntitlementsService, useValue: entitlements },
        ],
    }).compile()
    return {
        service: moduleRef.get(ContentMediaService),
        storage,
        members,
        renders,
        entitlements,
    }
}

describe("ContentMediaService", () => {
    it("lists pictures and videos and hides other files", async () => {
        const { service, storage, members } = await build()
        storage.list.mockResolvedValue(
            ok([
                { name: "notes.txt", createdAt: null },
                { name: STORED_PHOTO, createdAt: "2026-10-01T00:00:00.000Z" },
            ]),
        )

        await expect(service.library("user-1", "ws-1", 20)).resolves.toEqual([
            { kind: "media", path: PHOTO_PATH, name: "photo.png" },
        ])

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(storage.list).toHaveBeenCalledWith("media", "ws-1", 20)
    })

    it("refuses the library when storage cannot list", async () => {
        const { service, storage } = await build()
        storage.list.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(service.library("user-1", "ws-1", 20)).rejects.toBeInstanceOf(ContentMediaError)
        await expect(service.library("user-1", "ws-1", 20)).rejects.toMatchObject({
            code: ContentMediaErrorCode.StorageUnavailable,
        })
    })

    it("refuses a path outside the workspace before signing", async () => {
        const { service, storage, members } = await build()
        const request: ContentMediaRequest = { paths: ["other/file.png"], videoIds: [], limit: 12 }

        await expect(service.read("user-1", "ws-1", request)).rejects.toMatchObject({
            code: ContentMediaErrorCode.PathInvalid,
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(storage.list).not.toHaveBeenCalled()
    })
})

describe("ContentMediaService", () => {
    it("signs workspace files and videos and skips a video outside the workspace", async () => {
        const { service, storage, renders } = await build()
        storage.list.mockResolvedValue(ok([{ name: STORED_PHOTO, createdAt: "2026-10-01T00:00:00.000Z" }]))
        renders.listCompletedMedia.mockResolvedValue([CLIP])
        renders.findCompletedMedia.mockResolvedValue([CLIP, FOREIGN_CLIP])
        storage.signedUrls
            .mockResolvedValueOnce(
                ok([
                    { path: "ws-1/extra.png", signedUrl: "https://cdn.example/extra" },
                    { path: PHOTO_PATH, signedUrl: "https://cdn.example/photo" },
                ]),
            )
            .mockResolvedValueOnce(ok([{ path: "ws-1/clip.mp4", signedUrl: "https://cdn.example/clip" }]))

        await expect(
            service.read("user-1", "ws-1", {
                paths: ["ws-1/extra.png", PHOTO_PATH],
                videoIds: ["video-1", "video-3"],
                limit: 12,
            }),
        ).resolves.toEqual({
            library: [{ kind: "media", path: PHOTO_PATH, name: "photo.png" }],
            videos: [{ id: "video-1", name: "Video", createdAt: "2026-10-03T00:00:00.000Z", durationMs: null }],
            urls: [
                {
                    key: "ws-1/extra.png",
                    view: "https://cdn.example/extra",
                    download: "https://cdn.example/extra?download=extra.png",
                },
                {
                    key: PHOTO_PATH,
                    view: "https://cdn.example/photo",
                    download: "https://cdn.example/photo?download=photo.png",
                },
                {
                    key: "video:video-1",
                    view: "https://cdn.example/clip",
                    download: "https://cdn.example/clip?download=video.mp4",
                },
            ],
        })

        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", ["ws-1/extra.png", PHOTO_PATH], 3600)
        expect(storage.signedUrls).toHaveBeenNthCalledWith(2, "videos", ["ws-1/clip.mp4"], 3600)
        expect(renders.findCompletedMedia).toHaveBeenCalledWith("ws-1", ["video-1", "video-3"])
    })

    it("signs at most 80 addresses", async () => {
        const { service, storage, renders } = await build()
        const paths = Array.from({ length: 81 }, (_, index) => `ws-1/file-${index}.png`)
        const signed = paths.slice(0, 80).map((path) => ({ path, signedUrl: `https://cdn.example/${path}` }))
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([])
        renders.findCompletedMedia.mockResolvedValue([])
        storage.signedUrls.mockResolvedValueOnce(ok(signed)).mockResolvedValueOnce(ok([]))

        const data = await service.read("user-1", "ws-1", { paths, videoIds: [], limit: 5 })

        expect(data.urls).toHaveLength(80)
        expect(data.urls.map((url) => url.key)).toEqual(paths.slice(0, 80))
        expect(data.urls[0]).toEqual({
            key: "ws-1/file-0.png",
            view: "https://cdn.example/ws-1/file-0.png",
            download: "https://cdn.example/ws-1/file-0.png?download=file-0.png",
        })
        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", paths.slice(0, 80), 3600)
    })
})

describe("ContentMediaService", () => {
    it.each([
        { path: "", download: "https://cdn.example/file?download=" },
        { path: "ws-1/", download: "https://cdn.example/file?download=" },
        { path: "standalone.png", download: "https://cdn.example/file?download=standalone.png" },
    ])("keeps the final filename segment of the provider path $path", async ({ path, download }) => {
        const { service, storage, renders } = await build()
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([])
        renders.findCompletedMedia.mockResolvedValue([])
        storage.signedUrls
            .mockResolvedValueOnce(ok([{ path, signedUrl: "https://cdn.example/file" }]))
            .mockResolvedValueOnce(ok([]))

        await expect(service.read("user-1", "ws-1", { paths: [], videoIds: [], limit: 1 })).resolves.toEqual({
            library: [],
            videos: [],
            urls: [
                {
                    key: path,
                    view: "https://cdn.example/file",
                    download,
                },
            ],
        })
        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", [], 3600)
    })

    it("refuses when a signed address cannot be issued", async () => {
        const { service, storage, renders } = await build()
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([])
        renders.findCompletedMedia.mockResolvedValue([])
        storage.signedUrls.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(
            service.read("user-1", "ws-1", { paths: ["ws-1/extra.png"], videoIds: [], limit: 5 }),
        ).rejects.toMatchObject({
            code: ContentMediaErrorCode.StorageUnavailable,
        })
    })
})

describe("ContentMediaService", () => {
    it("uses the default filename when the provider path has no final segment", async () => {
        const { service, storage, renders } = await build()
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([])
        renders.findCompletedMedia.mockResolvedValue([])
        storage.signedUrls
            .mockResolvedValueOnce(ok([{ path: "ws-1/photo.png", signedUrl: "https://cdn.example/file" }]))
            .mockResolvedValueOnce(ok([]))
        const originalSplit = String.prototype.split
        const split = jest.spyOn(String.prototype, "split").mockImplementation(function (
            this: string,
            separator,
            limit,
        ) {
            const requestedSeparator: unknown = separator
            if (this === "ws-1/photo.png" && requestedSeparator === "/") return []
            return originalSplit.call(this, separator, limit)
        })

        const data = await service
            .read("user-1", "ws-1", { paths: [], videoIds: [], limit: 1 })
            .finally(() => split.mockRestore())

        expect(data).toEqual({
            library: [],
            videos: [],
            urls: [
                {
                    key: "ws-1/photo.png",
                    view: "https://cdn.example/file",
                    download: "https://cdn.example/file?download=file",
                },
            ],
        })
        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", [], 3600)
        expect(storage.signedUrls).toHaveBeenNthCalledWith(2, "videos", [], 3600)
    })

    it("issues an upload address for an accepted file", async () => {
        const entityManager = mockEntityManager({ query: [NEW_CONTENT_MEDIA_UPLOAD_ID, [{ id: "upload-1" }]] })
        const { service, storage, members, entitlements } = await build(entityManager)
        storage.signedUpload.mockResolvedValue(
            ok({ path: UPLOAD_PATH, token: "token-1", signedUrl: "https://upload.example/shop" }),
        )

        await expect(service.requestUpload("user-1", "ws-1", PICTURE)).resolves.toEqual({
            path: UPLOAD_PATH,
            token: "token-1",
            signedUrl: "https://upload.example/shop",
            name: "Shop Photo.png",
        })

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1", ["owner", "manager"])
        expect(entitlements.requireStorageFor).toHaveBeenCalledWith("ws-1", 1_200)
        expect(storage.signedUpload).toHaveBeenCalledWith("media", UPLOAD_PATH)
    })

    it("refuses a file that is not accepted media", async () => {
        const { service, entitlements } = await build()

        await expect(
            service.requestUpload("user-1", "ws-1", { name: "notes.txt", contentType: "text/plain", sizeBytes: 10 }),
        ).rejects.toMatchObject({ code: ContentMediaErrorCode.UploadInvalid })

        expect(entitlements.requireStorageFor).not.toHaveBeenCalled()
    })
})

describe("ContentMediaService", () => {
    it("refuses the upload when no object id is allocated", async () => {
        const entityManager = mockEntityManager({ query: [NEW_CONTENT_MEDIA_UPLOAD_ID, []] })
        const { service, storage } = await build(entityManager)

        await expect(service.requestUpload("user-1", "ws-1", PICTURE)).rejects.toMatchObject({
            code: ContentMediaErrorCode.StorageUnavailable,
        })

        expect(storage.signedUpload).not.toHaveBeenCalled()
    })

    it("refuses the upload when storage cannot sign it", async () => {
        const entityManager = mockEntityManager({ query: [NEW_CONTENT_MEDIA_UPLOAD_ID, [{ id: "upload-1" }]] })
        const { service, storage } = await build(entityManager)
        storage.signedUpload.mockResolvedValue(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(service.requestUpload("user-1", "ws-1", PICTURE)).rejects.toMatchObject({
            code: ContentMediaErrorCode.StorageUnavailable,
        })
    })

    it("filters listable files with unsafe workspace paths", async () => {
        const { service, storage } = await build()
        storage.list.mockResolvedValue(
            ok([
                { name: "../outside.png", createdAt: null },
                { name: "encoded%2fphoto.png", createdAt: null },
                { name: STORED_PHOTO, createdAt: null },
            ]),
        )

        await expect(service.library("user-1", "ws-1", 3)).resolves.toEqual([
            { kind: "media", path: PHOTO_PATH, name: "photo.png" },
        ])
        expect(storage.list).toHaveBeenCalledWith("media", "ws-1", 3)
    })

    it("keeps video titles and discards signed videos not returned by the render lookup", async () => {
        const { service, storage, renders } = await build()
        const video: CompletedRenderMedia = { ...CLIP, title: "Summer & sun", durationMs: 1_234 }
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([video])
        renders.findCompletedMedia.mockResolvedValue([video])
        storage.signedUrls.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(
            ok([
                { path: video.outputPath, signedUrl: "https://cdn.example/clip?token=one" },
                { path: "ws-1/unrequested.mp4", signedUrl: "https://cdn.example/unrequested" },
            ]),
        )

        await expect(service.read("user-1", "ws-1", { paths: [], videoIds: [video.id], limit: 2 })).resolves.toEqual({
            library: [],
            videos: [{ id: "video-1", name: "Summer & sun", createdAt: CLIP.createdAt, durationMs: 1_234 }],
            urls: [
                {
                    key: "video:video-1",
                    view: "https://cdn.example/clip?token=one",
                    download: "https://cdn.example/clip?token=one&download=Summer%20%26%20sun.mp4",
                },
            ],
        })
        expect(renders.listCompletedMedia).toHaveBeenCalledWith("ws-1", 10)
        expect(renders.findCompletedMedia).toHaveBeenCalledWith("ws-1", [video.id])
        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", [], 3600)
        expect(storage.signedUrls).toHaveBeenNthCalledWith(2, "videos", [video.outputPath], 3600)
    })
})

describe("ContentMediaService", () => {
    it("refuses when media signing succeeds but video signing fails", async () => {
        const { service, storage, renders } = await build()
        storage.list.mockResolvedValue(ok([]))
        renders.listCompletedMedia.mockResolvedValue([])
        renders.findCompletedMedia.mockResolvedValue([])
        storage.signedUrls.mockResolvedValueOnce(ok([])).mockResolvedValueOnce(refused("SUPABASE_PROVIDER_UNAVAILABLE"))

        await expect(service.read("user-1", "ws-1", { paths: [], videoIds: [], limit: 1 })).rejects.toMatchObject({
            code: ContentMediaErrorCode.StorageUnavailable,
        })
        expect(storage.signedUrls).toHaveBeenNthCalledWith(1, "media", [], 3600)
        expect(storage.signedUrls).toHaveBeenNthCalledWith(2, "videos", [], 3600)
    })
})
