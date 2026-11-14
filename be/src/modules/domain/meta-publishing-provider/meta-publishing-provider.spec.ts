import { mock } from "@starci/jest-preset"
import type { ConnectionRecord, ConnectionsService, Provider } from "@modules/domain/connections"
import { proofOf, ProviderRegistryErrorCode } from "@modules/domain/provider-registry"
import type { InstagramMediaRequest } from "@modules/domain/provider-registry"
import { MetaPublishingError, MetaPublishingErrorCode } from "@modules/integrations/meta-publishing"
import type { MetaPublishingClient } from "@modules/integrations/meta-publishing"
import { connectionRecord } from "@tests/fixtures/builders/connection-records.builder"
import { MetaFacebookPublishService } from "./meta-facebook-publish.service"
import { MetaInstagramPublishService } from "./meta-instagram-publish.service"
import { MetaPublishingCredentialService } from "./meta-publishing-credential.service"

const TOKEN = ["page", "token"].join("-")
const account = (meta: Record<string, string> = { ig_id: "9001" }, provider: Provider = "meta"): ConnectionRecord =>
    connectionRecord({ id: "conn-m", workspaceId: "ws-1", provider, name: "Page", meta })

const build = () => {
    const connections = mock<ConnectionsService>()
    connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ pageId: "123", pageToken: TOKEN }), webhookSecret: "hook" })
    const client = mock<MetaPublishingClient>()
    const credentials = new MetaPublishingCredentialService(connections)
    return { facebook: new MetaFacebookPublishService(client, credentials), instagram: new MetaInstagramPublishService(client, credentials), client, connections }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))
const ACCESS = { token: TOKEN, pageId: "123", igId: "9001" }

describe("MetaFacebookPublishService", () => {
    it("posts a text and a link post to the feed edge and answers the post id", async () => {
        const { facebook, client } = build()
        client.postFeed.mockResolvedValue({ id: "123_1" })

        await expect(facebook.publish(account(), { message: "Hi", link: null, media: null })).resolves.toEqual({ kind: "text", postId: "123_1", mediaId: null })
        await expect(facebook.publish(account(), { message: null, link: "https://x.test", media: null })).resolves.toMatchObject({ kind: "link" })
        expect(client.postFeed).toHaveBeenCalledWith(ACCESS, { message: "Hi", link: null })
    })

    it("posts a photo with the message as caption, and a video with the message as description and its title", async () => {
        const { facebook, client } = build()
        client.postPhoto.mockResolvedValue({ id: "p1", postId: "123_p" })
        client.postVideo.mockResolvedValue({ id: "v1" })

        await expect(facebook.publish(account(), { message: "cap", link: null, media: { kind: "photo", url: "https://x/a.jpg", title: null } })).resolves.toEqual({
            kind: "photo",
            postId: "123_p",
            mediaId: "p1",
        })
        await expect(facebook.publish(account(), { message: "desc", link: null, media: { kind: "video", url: "https://x/a.mp4", title: "T" } })).resolves.toEqual({
            kind: "video",
            postId: null,
            mediaId: "v1",
        })
        expect(client.postPhoto).toHaveBeenCalledWith(ACCESS, { url: "https://x/a.jpg", caption: "cap" })
        expect(client.postVideo).toHaveBeenCalledWith(ACCESS, { fileUrl: "https://x/a.mp4", description: "desc", title: "T" })
    })

    it("refuses an empty post and an account without a chosen Page before anything is sent (not_sent)", async () => {
        const { facebook, client, connections } = build()
        const empty = await failure(facebook.publish(account(), { message: null, link: null, media: null }))
        expect(empty).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
        expect(proofOf(empty)).toBe("not_sent")

        connections.readSecret.mockResolvedValue({ plain: JSON.stringify({ pages: [] }), webhookSecret: "hook" })
        const none = await failure(facebook.publish(account(), { message: "x", link: null, media: null }))
        expect(none).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(proofOf(none)).toBe("not_sent")
        expect(client.postFeed).not.toHaveBeenCalled()
    })

    it("maps what the client failed with: a refused credential is a refusal proving nothing was done, a transport failure may have acted", async () => {
        const { facebook, client } = build()
        client.postFeed.mockRejectedValueOnce(new MetaPublishingError({ code: MetaPublishingErrorCode.AuthFailed, params: { status: 400, code: 190, detail: "expired" } }))
        const refused = await failure(facebook.publish(account(), { message: "x", link: null, media: null }))
        expect(refused).toMatchObject({ code: ProviderRegistryErrorCode.RefusedAuth, params: { detail: "expired" } })
        expect(proofOf(refused)).toBe("not_sent")

        client.postFeed.mockRejectedValueOnce(new MetaPublishingError({ code: MetaPublishingErrorCode.Unreachable }))
        const lost = await failure(facebook.publish(account(), { message: "x", link: null, media: null }))
        expect(proofOf(lost)).toBe("unknown")
    })
})

describe("MetaInstagramPublishService", () => {
    const image: InstagramMediaRequest = { mediaType: "image", caption: "c", mediaUrl: "https://x/a.jpg", children: [], altText: "alt", aiGenerated: null }

    it("creates the container, reads it and publishes it when it is finished", async () => {
        const { instagram, client } = build()
        client.createContainer.mockResolvedValue("c1")
        client.containerStatus.mockResolvedValue("FINISHED")
        client.publishContainer.mockResolvedValue("m1")

        await expect(instagram.publish(account(), image)).resolves.toEqual({ containerId: "c1", state: "published", statusCode: "PUBLISHED", mediaId: "m1" })
        expect(client.createContainer).toHaveBeenCalledWith(ACCESS, expect.objectContaining({ imageUrl: "https://x/a.jpg", caption: "c", altText: "alt", mediaType: null }))
        expect(client.publishContainer).toHaveBeenCalledWith(ACCESS, "c1")
    })

    it("answers a container still processing as pending and does not publish it", async () => {
        const { instagram, client } = build()
        client.createContainer.mockResolvedValue("c1")
        client.containerStatus.mockResolvedValue("IN_PROGRESS")

        await expect(instagram.publish(account(), { ...image, mediaType: "reels", mediaUrl: "https://x/a.mp4" })).resolves.toEqual({
            containerId: "c1",
            state: "pending",
            statusCode: "IN_PROGRESS",
            mediaId: null,
        })
        expect(client.createContainer).toHaveBeenCalledWith(ACCESS, expect.objectContaining({ mediaType: "REELS", videoUrl: "https://x/a.mp4" }))
        expect(client.publishContainer).not.toHaveBeenCalled()
    })

    it("creates one container per carousel item, then the carousel container over their ids", async () => {
        const { instagram, client } = build()
        client.createContainer.mockResolvedValueOnce("k1").mockResolvedValueOnce("k2").mockResolvedValueOnce("car")
        client.containerStatus.mockResolvedValue("IN_PROGRESS")

        await instagram.publish(account(), {
            mediaType: "carousel",
            caption: "Fruit",
            mediaUrl: null,
            children: [
                { kind: "image", url: "https://x/1.jpg" },
                { kind: "video", url: "https://x/2.mp4" },
            ],
            altText: null,
            aiGenerated: true,
        })

        expect(client.createContainer).toHaveBeenNthCalledWith(1, ACCESS, expect.objectContaining({ imageUrl: "https://x/1.jpg", isCarouselItem: true }))
        expect(client.createContainer).toHaveBeenNthCalledWith(2, ACCESS, expect.objectContaining({ mediaType: "VIDEO", videoUrl: "https://x/2.mp4", isCarouselItem: true }))
        expect(client.createContainer).toHaveBeenNthCalledWith(3, ACCESS, expect.objectContaining({ mediaType: "CAROUSEL", children: ["k1", "k2"], caption: "Fruit", aiGenerated: true }))
        expect(client.containerStatus).toHaveBeenCalledWith(ACCESS, "car")
    })

    it("reads a container by id (a pure read) and releases it, publishing only when it is finished", async () => {
        const { instagram, client } = build()
        client.containerStatus.mockResolvedValue("FINISHED")
        await expect(instagram.status(account(), "c1")).resolves.toEqual({ containerId: "c1", state: "ready", statusCode: "FINISHED", mediaId: null })
        expect(client.publishContainer).not.toHaveBeenCalled()

        client.publishContainer.mockResolvedValue("m9")
        await expect(instagram.release(account(), "c1")).resolves.toMatchObject({ state: "published", mediaId: "m9" })

        client.containerStatus.mockResolvedValue("EXPIRED")
        await expect(instagram.release(account(), "c1")).resolves.toMatchObject({ state: "failed", statusCode: "EXPIRED" })
    })

    it("refuses a carousel of no item or more than twenty items, a missing media url, and an account without an Instagram link", async () => {
        const { instagram, client } = build()
        const carousel: InstagramMediaRequest = { ...image, mediaType: "carousel", mediaUrl: null }
        const item = { kind: "image", url: "https://x/1.jpg" } as const

        for (const request of [
            { ...carousel, children: [] },
            { ...carousel, children: Array.from({ length: 21 }, () => item) },
            { ...image, mediaUrl: null },
        ]) {
            const cause = await failure(instagram.publish(account(), request))
            expect(cause).toMatchObject({ code: ProviderRegistryErrorCode.RefusedRejected })
            expect(proofOf(cause)).toBe("not_sent")
        }
        const unlinked = await failure(instagram.publish(account({}), image))
        expect(unlinked).toMatchObject({ code: ProviderRegistryErrorCode.RefusedNoCredential })
        expect(client.createContainer).not.toHaveBeenCalled()
    })
})
