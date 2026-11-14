import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { HTTP_CLIENT, HttpError, HttpErrorCode } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { MetaPublishingErrorCode } from "./errors/meta-publishing.error"
import { MetaPublishingClient, containerFormOf, containerStatusOf } from "./meta-publishing.client"
import { META_PUBLISHING_OPTIONS } from "./meta-publishing.decorators"
import { META_PUBLISHING_OPERATIONS } from "./meta-publishing.operations"
import type { MetaPublishingAccess, ContainerRequest } from "./meta-publishing.contracts"
import type { MetaPublishingOptions } from "./meta-publishing.options"

const BASE = "https://graph.facebook.com/v27.0"
const options: MetaPublishingOptions = { graphBase: BASE, timeoutMs: 4000 }
const TOKEN = ["test", "token"].join("-")
const access: MetaPublishingAccess = { token: TOKEN, pageId: "123456", igId: "90010177253934" }

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [MetaPublishingClient, { provide: HTTP_CLIENT, useValue: http }, { provide: META_PUBLISHING_OPTIONS, useValue: options }],
    }).compile()
    return { client: moduleRef.get(MetaPublishingClient), http }
}

const failure = (work: Promise<unknown>): Promise<unknown> => Promise.resolve(work.then(() => undefined, (cause: unknown) => cause))

const emptyContainer: ContainerRequest = {
    mediaType: null,
    imageUrl: null,
    videoUrl: null,
    caption: null,
    altText: null,
    isCarouselItem: null,
    children: [],
    aiGenerated: null,
}

describe("MetaPublishingClient > Page posts", () => {
    it("posts a message and a link to the feed edge with the token as a form field and reads `id` (https://developers.facebook.com/docs/graph-api/reference/page/feed/)", async () => {
        const { client, http } = await build()
        // The reference's own response: `{"id":"{post-id}"}`.
        http.request.mockResolvedValue({ status: 200, body: { id: "123456_789" } })

        await expect(client.postFeed(access, { message: "Become a Facebook developer!", link: "https://developers.facebook.com" })).resolves.toEqual({
            id: "123456_789",
        })
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/123456/feed`,
            form: { message: "Become a Facebook developer!", link: "https://developers.facebook.com", access_token: TOKEN },
            timeoutMs: 4000,
        })
    })

    it("posts a photo by `url` with its `caption` and reads `id` and `post_id` (https://developers.facebook.com/docs/graph-api/reference/page/photos/)", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { id: "555", post_id: "123456_556" } })

        await expect(client.postPhoto(access, { url: "https://example.com/a.jpg", caption: "Hi" })).resolves.toEqual({ id: "555", postId: "123456_556" })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: `${BASE}/123456/photos`, form: { url: "https://example.com/a.jpg", caption: "Hi", access_token: TOKEN } }),
        )
    })

    it("posts a video by `file_url` with `description` and `title` (https://developers.facebook.com/docs/graph-api/reference/page/videos/)", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { id: "777" } })

        await expect(client.postVideo(access, { fileUrl: "https://example.com/a.mp4", description: "d", title: "t" })).resolves.toEqual({ id: "777" })
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `${BASE}/123456/videos`,
                form: { file_url: "https://example.com/a.mp4", description: "d", title: "t", access_token: TOKEN },
            }),
        )
    })

    it("refuses an id that is no path segment before anything leaves", async () => {
        const { client, http } = await build()
        const cause = await failure(client.postFeed({ ...access, pageId: "1/../2" }, { message: "x", link: null }))

        expect(cause).toMatchObject({ code: MetaPublishingErrorCode.Rejected })
        expect(http.request).not.toHaveBeenCalled()
    })
})

describe("MetaPublishingClient > Instagram content publishing (https://developers.facebook.com/docs/instagram-platform/content-publishing)", () => {
    it("creates a single image container with `image_url` and `caption` and reads the container `id`", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { id: "17889" } })

        await expect(client.createContainer(access, { ...emptyContainer, imageUrl: "https://www.example.com/images/bronz-fonz.jpg", caption: "Hello" })).resolves.toBe("17889")
        expect(http.request).toHaveBeenCalledWith({
            method: "POST",
            url: `${BASE}/90010177253934/media`,
            form: { image_url: "https://www.example.com/images/bronz-fonz.jpg", caption: "Hello", access_token: TOKEN },
            timeoutMs: 4000,
        })
    })

    it("builds a reel container (`media_type` REELS + `video_url`) and a carousel container (`media_type` CAROUSEL + comma-separated `children`)", () => {
        expect(containerFormOf({ ...emptyContainer, mediaType: "REELS", videoUrl: "https://www.example.com/videos/bronz-fonz.mp4" })).toEqual({
            media_type: "REELS",
            video_url: "https://www.example.com/videos/bronz-fonz.mp4",
        })
        expect(containerFormOf({ ...emptyContainer, mediaType: "CAROUSEL", caption: "Fruit candies", children: ["a1", "a2", "a3"], aiGenerated: true })).toEqual({
            media_type: "CAROUSEL",
            caption: "Fruit candies",
            children: "a1,a2,a3",
            is_ai_generated: "true",
        })
        expect(containerFormOf({ ...emptyContainer, imageUrl: "https://x/y.jpg", isCarouselItem: true })).toEqual({ image_url: "https://x/y.jpg", is_carousel_item: "true" })
    })

    it("publishes a container with `creation_id` and reads the media `id`", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { id: "18000" } })

        await expect(client.publishContainer(access, "17889")).resolves.toBe("18000")
        expect(http.request).toHaveBeenCalledWith(
            expect.objectContaining({ url: `${BASE}/90010177253934/media_publish`, form: { creation_id: "17889", access_token: TOKEN } }),
        )
    })

    it("reads the container's `status_code` with a bearer header", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 200, body: { status_code: "FINISHED", id: "17889" } })

        await expect(client.containerStatus(access, "17889")).resolves.toBe("FINISHED")
        expect(http.request).toHaveBeenCalledWith({
            method: "GET",
            url: `${BASE}/17889?fields=status_code`,
            headers: { authorization: `Bearer ${TOKEN}` },
            timeoutMs: 4000,
        })
    })

    it("accepts the five documented status words and refuses any other as malformed", () => {
        for (const word of ["EXPIRED", "ERROR", "FINISHED", "IN_PROGRESS", "PUBLISHED"]) {
            expect(containerStatusOf({ status_code: word })).toBe(word)
        }
        expect(() => containerStatusOf({ status_code: "WAITING" })).toThrow()
        expect(() => containerStatusOf({})).toThrow()
    })
})

describe("MetaPublishingClient > failures", () => {
    // The error body format of https://developers.facebook.com/docs/graph-api/guides/error-handling.
    const graphError = (code: number, subcode?: number) => ({
        error: { message: "A message", type: "OAuthException", code, ...(subcode === undefined ? {} : { error_subcode: subcode }), fbtrace_id: "EJplcsCHuLu" },
    })

    it.each([
        [400, graphError(190, 460), MetaPublishingErrorCode.AuthFailed],
        [400, graphError(10), MetaPublishingErrorCode.AuthFailed],
        [403, graphError(200), MetaPublishingErrorCode.AuthFailed],
        [400, graphError(4), MetaPublishingErrorCode.RateLimited],
        [400, graphError(17), MetaPublishingErrorCode.RateLimited],
        [500, graphError(2), MetaPublishingErrorCode.Failed],
        [400, graphError(1), MetaPublishingErrorCode.Failed],
        [400, graphError(506), MetaPublishingErrorCode.Rejected],
        [400, graphError(1609005), MetaPublishingErrorCode.Rejected],
        [404, {}, MetaPublishingErrorCode.NotFound],
        [502, {}, MetaPublishingErrorCode.Failed],
    ])("types an answer of status %s by Graph's numeric code, then by the status class", async (status, body, code) => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status, body })

        await expect(failure(client.postFeed(access, { message: "x", link: null }))).resolves.toMatchObject({ code })
    })

    it("carries the status, Graph's code and its words in the params", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValue({ status: 400, body: graphError(506) })

        const cause = await failure(client.postFeed(access, { message: "x", link: null }))
        expect(cause).toMatchObject({ params: { status: 400, code: 506, detail: "A message" } })
    })

    it("types a transport failure as unreachable (the request may have left) and an unreadable success as malformed", async () => {
        const { client, http } = await build()
        http.request.mockRejectedValue(new HttpError({ code: HttpErrorCode.Timeout }))
        await expect(failure(client.postFeed(access, { message: "x", link: null }))).resolves.toMatchObject({ code: MetaPublishingErrorCode.Unreachable })

        http.request.mockResolvedValue({ status: 200, body: { nothing: true } })
        await expect(failure(client.postFeed(access, { message: "x", link: null }))).resolves.toMatchObject({ code: MetaPublishingErrorCode.Malformed })
    })
})

describe("META_PUBLISHING_OPERATIONS", () => {
    it("states six built operations, each with its official documentation", () => {
        const operations = Object.values(META_PUBLISHING_OPERATIONS)
        expect(operations).toHaveLength(6)
        for (const operation of operations) {
            expect(operation.status).toBe("built")
            expect(operation.docs).toMatch(/^https:\/\/developers\.facebook\.com\/docs\//u)
        }
    })
})
