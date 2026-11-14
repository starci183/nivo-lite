import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService } from "@modules/domain/connections"
import { ToolsError, type NativeCaller } from "@modules/domain/tools"
import {
    FacebookPublishRegistryService,
    InstagramPublishRegistryService,
    providerRefusal,
    YoutubePublishRegistryService,
} from "@modules/domain/provider-registry"
import type { FacebookPublishPort, InstagramPublishPort, YoutubePublishPort } from "@modules/domain/provider-registry"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { FACEBOOK_POST_PUBLISH_SCHEMA } from "./facebook-native.schema"
import { FacebookNativeService } from "./facebook-native.service"
import { INSTAGRAM_MEDIA_PUBLISH_SCHEMA, INSTAGRAM_MEDIA_STATUS_GET_SCHEMA } from "./instagram-native.schema"
import { InstagramNativeService } from "./instagram-native.service"
import { SOCIAL_BUSINESS_REFUSALS, SOCIAL_REFUSAL_CLASS, SOCIAL_REFUSALS } from "./social-refusal.policy"
import { SOCIAL_TOOL_NAME } from "./social-tools.tool-ids"
import { tagsLengthOf } from "./youtube-tags.policy"
import { YOUTUBE_VIDEO_PUBLISH_SCHEMA, YOUTUBE_VIDEO_STATUS_GET_SCHEMA } from "./youtube-native.schema"
import { YoutubeNativeService } from "./youtube-native.service"

const account = connectionRecord({ id: "conn-1", workspaceId: "ws-1", provider: "meta" })
const caller: NativeCaller = { agentId: "agent-1", conversationId: null, connectionId: "conn-1" }

const connectionsOf = (found: ConnectionRecord | null): ConnectionsService => {
    const connections = mock<ConnectionsService>()
    connections.find.mockResolvedValue(found)
    return connections
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const refusalOf = (cause: unknown): unknown => (cause instanceof ToolsError ? cause.params : cause)

describe("social refusals", () => {
    it("states a total class for every refusal, and business ones are exactly rejected and not_found", () => {
        expect(Object.keys(SOCIAL_REFUSAL_CLASS).sort()).toEqual([...SOCIAL_REFUSALS].sort())
        const business = SOCIAL_REFUSALS.filter((reason) => SOCIAL_REFUSAL_CLASS[reason] === "business")
        expect([...business].sort()).toEqual([...SOCIAL_BUSINESS_REFUSALS].sort())
    })
})

describe("nivo.tool.facebook.post.publish > schema", () => {
    const ok = (value: unknown): boolean => FACEBOOK_POST_PUBLISH_SCHEMA.safeParse(value).success

    it("takes a message, a link, or a photo / video, and nothing else", () => {
        expect(ok({ message: "Hi" })).toBe(true)
        expect(ok({ link: "https://example.com" })).toBe(true)
        expect(ok({ message: "cap", media: { kind: "photo", url: "https://example.com/a.jpg" } })).toBe(true)
        expect(ok({ media: { kind: "video", url: "https://example.com/a.mp4", title: "T" } })).toBe(true)
        expect(ok({})).toBe(false)
        expect(ok({ message: "x", extra: 1 })).toBe(false)
    })

    it("refuses a link beside media, a photo title, an http address and an empty message", () => {
        expect(ok({ link: "https://example.com", media: { kind: "photo", url: "https://example.com/a.jpg" } })).toBe(false)
        expect(ok({ media: { kind: "photo", url: "https://example.com/a.jpg", title: "T" } })).toBe(false)
        expect(ok({ media: { kind: "photo", url: "http://example.com/a.jpg" } })).toBe(false)
        expect(ok({ message: "   " })).toBe(false)
    })
})

describe("FacebookNativeService", () => {
    const build = (port: FacebookPublishPort | undefined, found: ConnectionRecord | null = account) => {
        const registry = new FacebookPublishRegistryService()
        if (port !== undefined) registry.register(port)
        return new FacebookNativeService(connectionsOf(found), registry)
    }

    it("publishes through the port of the handed account and answers the post", async () => {
        const port = mock<FacebookPublishPort>()
        Object.defineProperty(port, "provider", { value: "meta" })
        port.publish.mockResolvedValue({ kind: "photo", postId: "1_2", mediaId: "2" })

        await expect(
            build(port).invoke("ws-1", SOCIAL_TOOL_NAME.facebookPostPublish, { message: "cap", media: { kind: "photo", url: "https://example.com/a.jpg" } }, caller),
        ).resolves.toEqual({ kind: "photo", postId: "1_2", mediaId: "2" })
        expect(port.publish).toHaveBeenCalledWith(account, { message: "cap", link: null, media: { kind: "photo", url: "https://example.com/a.jpg", title: null } })
    })

    it("refuses not_connected with no account handed, an unknown account or a provider that serves no Facebook", async () => {
        const port = mock<FacebookPublishPort>()
        Object.defineProperty(port, "provider", { value: "other" })
        for (const service of [build(port), build(port, null), build(undefined)]) {
            const cause = await failure(service.invoke("ws-1", SOCIAL_TOOL_NAME.facebookPostPublish, { message: "x" }, service === undefined ? caller : { agentId: "agent-1", conversationId: null, connectionId: undefined }))
            expect(refusalOf(cause)).toMatchObject({ reason: "not_connected", refusalClass: "infrastructure" })
        }
        expect(refusalOf(await failure(build(port).invoke("ws-1", SOCIAL_TOOL_NAME.facebookPostPublish, { message: "x" }, caller)))).toMatchObject({ reason: "not_connected" })
    })

    it("answers a provider's refusal as the tool's own, business for rejected and infrastructure for a refused credential", async () => {
        const port = mock<FacebookPublishPort>()
        Object.defineProperty(port, "provider", { value: "meta" })
        port.publish.mockRejectedValueOnce(providerRefusal("meta", "rejected", "duplicate"))
        expect(refusalOf(await failure(build(port).invoke("ws-1", SOCIAL_TOOL_NAME.facebookPostPublish, { message: "x" }, caller)))).toMatchObject({ reason: "rejected", refusalClass: "business" })

        port.publish.mockRejectedValueOnce(providerRefusal("meta", "auth_refused"))
        expect(refusalOf(await failure(build(port).invoke("ws-1", SOCIAL_TOOL_NAME.facebookPostPublish, { message: "x" }, caller)))).toMatchObject({ reason: "connection_refused", refusalClass: "infrastructure" })
    })
})

describe("Instagram schemas", () => {
    const ok = (value: unknown): boolean => INSTAGRAM_MEDIA_PUBLISH_SCHEMA.safeParse(value).success

    it("takes an image, video, reel with a media url and a carousel with up to 20 items", () => {
        expect(ok({ mediaType: "image", mediaUrl: "https://example.com/a.jpg", caption: "c", altText: "a" })).toBe(true)
        expect(ok({ mediaType: "reels", mediaUrl: "https://example.com/a.mp4" })).toBe(true)
        const item = { kind: "image", url: "https://example.com/a.jpg" }
        expect(ok({ mediaType: "carousel", children: Array.from({ length: 20 }, () => item) })).toBe(true)
        expect(ok({ mediaType: "carousel", children: Array.from({ length: 21 }, () => item) })).toBe(false)
    })

    it("refuses a media url on a carousel, children on an image, no media, a stray alt text, and mixing a container id with media", () => {
        expect(ok({ mediaType: "carousel", mediaUrl: "https://example.com/a.jpg", children: [{ kind: "image", url: "https://example.com/a.jpg" }] })).toBe(false)
        expect(ok({ mediaType: "image", children: [{ kind: "image", url: "https://example.com/a.jpg" }] })).toBe(false)
        expect(ok({ mediaType: "image" })).toBe(false)
        expect(ok({ mediaType: "video", mediaUrl: "https://example.com/a.mp4", altText: "a" })).toBe(false)
        expect(ok({ containerId: "17889", caption: "c" })).toBe(false)
        expect(ok({})).toBe(false)
    })

    it("lets a container id stand alone, and the status read takes only that id", () => {
        expect(ok({ containerId: "17889" })).toBe(true)
        expect(INSTAGRAM_MEDIA_STATUS_GET_SCHEMA.safeParse({ containerId: "17889" }).success).toBe(true)
        expect(INSTAGRAM_MEDIA_STATUS_GET_SCHEMA.safeParse({ containerId: "../x" }).success).toBe(false)
        expect(INSTAGRAM_MEDIA_STATUS_GET_SCHEMA.safeParse({ containerId: "1", publish: true }).success).toBe(false)
    })
})

describe("InstagramNativeService", () => {
    const build = (port: InstagramPublishPort) => {
        const registry = new InstagramPublishRegistryService()
        registry.register(port)
        return new InstagramNativeService(connectionsOf(account), registry)
    }
    const portOf = () => {
        const port = mock<InstagramPublishPort>()
        Object.defineProperty(port, "provider", { value: "meta" })
        return port
    }

    it("publishes new media, finishes a container by its id, and reads a status", async () => {
        const port = portOf()
        const pending = { containerId: "c1", state: "pending", statusCode: "IN_PROGRESS", mediaId: null } as const
        port.publish.mockResolvedValue(pending)
        port.release.mockResolvedValue({ containerId: "c1", state: "published", statusCode: "PUBLISHED", mediaId: "m1" })
        port.status.mockResolvedValue(pending)
        const service = build(port)

        await expect(service.invoke("ws-1", SOCIAL_TOOL_NAME.instagramMediaPublish, { mediaType: "reels", mediaUrl: "https://example.com/a.mp4" }, caller)).resolves.toEqual(pending)
        expect(port.publish).toHaveBeenCalledWith(account, { mediaType: "reels", caption: null, mediaUrl: "https://example.com/a.mp4", children: [], altText: null, aiGenerated: null })
        await expect(service.invoke("ws-1", SOCIAL_TOOL_NAME.instagramMediaPublish, { containerId: "c1" }, caller)).resolves.toMatchObject({ state: "published", mediaId: "m1" })
        await expect(service.invoke("ws-1", SOCIAL_TOOL_NAME.instagramMediaStatusGet, { containerId: "c1" }, caller)).resolves.toEqual(pending)
        expect(port.release).toHaveBeenCalledWith(account, "c1")
    })

    it("refuses a tool it does not have", async () => {
        const cause = await failure(build(portOf()).invoke("ws-1", "instagram.other", {}, caller))
        expect(cause).toBeInstanceOf(ToolsError)
    })
})

describe("YouTube schemas", () => {
    const base = { videoFileId: "file-1", title: "My video" }
    const ok = (value: unknown): boolean => YOUTUBE_VIDEO_PUBLISH_SCHEMA.safeParse(value).success

    it("takes the documented members within the documented bounds", () => {
        expect(ok({ ...base, description: "d", tags: ["a", "b c"], categoryId: "22", privacyStatus: "unlisted", madeForKids: false, notifySubscribers: true, playlistId: "PL_x-1" })).toBe(true)
        expect(ok({ ...base, privacyStatus: "private", publishAt: "2026-12-01T10:00:00Z" })).toBe(true)
    })

    it("bounds the title to 100 characters and refuses < and > in the title and description", () => {
        expect(ok({ ...base, title: "x".repeat(100) })).toBe(true)
        expect(ok({ ...base, title: "x".repeat(101) })).toBe(false)
        expect(ok({ ...base, title: "a<b" })).toBe(false)
        expect(ok({ ...base, description: "a>b" })).toBe(false)
    })

    it("bounds the description to 5000 BYTES, not characters", () => {
        expect(ok({ ...base, description: "a".repeat(5000) })).toBe(true)
        expect(ok({ ...base, description: "a".repeat(5001) })).toBe(false)
        expect(ok({ ...base, description: "\u00e9".repeat(2501) })).toBe(false)
    })

    it("counts tags as YouTube does: commas count and a tag with a space counts its quotation marks", () => {
        expect(tagsLengthOf(["Foo-Baz"])).toBe(7)
        expect(tagsLengthOf(["Foo Baz"])).toBe(9)
        expect(tagsLengthOf(["a", "b"])).toBe(3)
        expect(ok({ ...base, tags: ["x".repeat(500)] })).toBe(true)
        expect(ok({ ...base, tags: ["x".repeat(499), "y"] })).toBe(false)
    })

    it("allows publishAt only for a private video, and refuses an id that is no query value", () => {
        expect(ok({ ...base, publishAt: "2026-12-01T10:00:00Z" })).toBe(false)
        expect(ok({ ...base, privacyStatus: "public", publishAt: "2026-12-01T10:00:00Z" })).toBe(false)
        expect(ok({ ...base, playlistId: "a&b" })).toBe(false)
        expect(YOUTUBE_VIDEO_STATUS_GET_SCHEMA.safeParse({ videoId: "abc123" }).success).toBe(true)
        expect(YOUTUBE_VIDEO_STATUS_GET_SCHEMA.safeParse({ videoId: "a b" }).success).toBe(false)
    })
})

describe("YoutubeNativeService", () => {
    const portOf = () => {
        const port = mock<YoutubePublishPort>()
        Object.defineProperty(port, "provider", { value: "meta" })
        return port
    }
    const build = (port: YoutubePublishPort) => {
        const registry = new YoutubePublishRegistryService()
        registry.register(port)
        return new YoutubeNativeService(connectionsOf(account), registry)
    }
    const video = { videoId: "abc123", state: "pending", uploadStatus: "uploaded", reason: null, privacyStatus: "private", processingStatus: null, playlistItemId: null, playlistFailure: null } as const

    it("hands the port the workspace and the request in YouTube's own members, and answers the video", async () => {
        const port = portOf()
        port.publish.mockResolvedValue(video)
        const service = build(port)

        await expect(
            service.invoke("ws-1", SOCIAL_TOOL_NAME.youtubeVideoPublish, { videoFileId: "file-1", title: "T", tags: ["a"], privacyStatus: "private", thumbnailFileId: "th-1" }, caller),
        ).resolves.toEqual(video)
        expect(port.publish).toHaveBeenCalledWith("ws-1", account, {
            video: { fileId: "file-1" },
            title: "T",
            description: "",
            tags: ["a"],
            categoryId: null,
            privacyStatus: "private",
            publishAt: null,
            madeForKids: null,
            notifySubscribers: null,
            thumbnail: { fileId: "th-1" },
            playlistId: null,
        })
    })

    it("reads a status and answers a not_found refusal as business", async () => {
        const port = portOf()
        port.status.mockResolvedValueOnce(video)
        const service = build(port)
        await expect(service.invoke("ws-1", SOCIAL_TOOL_NAME.youtubeVideoStatusGet, { videoId: "abc123" }, caller)).resolves.toEqual(video)

        port.status.mockRejectedValueOnce(providerRefusal("google", "not_found"))
        expect(refusalOf(await failure(service.invoke("ws-1", SOCIAL_TOOL_NAME.youtubeVideoStatusGet, { videoId: "abc123" }, caller)))).toMatchObject({ reason: "not_found", refusalClass: "business" })
    })
})
