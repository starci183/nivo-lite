import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { Secret } from "@modules/platform/config"
import { HTTP_CLIENT } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaErrorCode } from "./errors/meta.error"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"
import { MetaPublishingClient } from "./meta-publishing.client"

const OPTIONS: MetaOptions = {
    app: { appId: "app-1", appSecret: new Secret("secret-1") },
    webhookVerifyToken: undefined,
    loginConfigId: undefined,
    graphVersion: undefined,
    siteUrl: "https://nivo.vn",
    channelTokenKey: new Secret(Buffer.alloc(32, 3).toString("base64")),
    sendPerMinute: 2,
    timeoutMs: 4000,
}
const PAGE = { pageId: "PAGE", pageToken: "ptok" }
const NOW = "2026-10-20T03:00:00.000Z"
const NOW_S = Date.parse(NOW) / 1000

const build = async () => {
    const http = mock<HttpClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaPublishingClient,
            { provide: HTTP_CLIENT, useValue: http },
            { provide: META_OPTIONS, useValue: OPTIONS },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: mock<Logger>() },
        ],
    }).compile()
    return { client: moduleRef.get(MetaPublishingClient), http }
}

const answer = (body: unknown, status = 200) => ({ status, body })

describe("MetaPublishingClient / schedulePagePost", () => {
    it("uploads unpublished photos then schedules the feed post with them", async () => {
        const { client, http } = await build()
        http.request
            .mockResolvedValueOnce(answer({ id: "ph1" }))
            .mockResolvedValueOnce(answer({ id: "ph2" }))
            .mockResolvedValueOnce(answer({ id: "PAGE_1" }))
        const publishAt = new Date(Date.parse(NOW) + 86_400_000)

        await expect(
            client.schedulePagePost(PAGE, {
                message: "Hello",
                imageUrls: ["https://x/a.png", "https://x/b.png"],
                publishAt,
            }),
        ).resolves.toEqual({ postId: "PAGE_1", photoIds: ["ph1", "ph2"], scheduledPublishTime: NOW_S + 86_400 })
        const photoUrl = new URL(String(http.request.mock.calls[0]?.[0].url))
        expect(photoUrl.pathname).toBe("/v21.0/PAGE/photos")
        expect(photoUrl.searchParams.get("published")).toBe("false")
        expect(photoUrl.searchParams.get("url")).toBe("https://x/a.png")
        expect(http.request.mock.calls[2]?.[0]).toEqual(
            expect.objectContaining({
                method: "POST",
                body: {
                    message: "Hello",
                    published: false,
                    scheduled_publish_time: NOW_S + 86_400,
                    attached_media: [{ media_fbid: "ph1" }, { media_fbid: "ph2" }],
                },
            }),
        )
    })

    it("moves a too-early moment to eleven minutes ahead and posts text only without images", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({ id: "PAGE_2" }))

        const result = await client.schedulePagePost(PAGE, { message: "Hi", imageUrls: [], publishAt: new Date(NOW) })

        expect(result).toEqual({ postId: "PAGE_2", photoIds: [], scheduledPublishTime: NOW_S + 660 })
        expect(http.request.mock.calls[0]?.[0].body).toEqual({
            message: "Hi",
            published: false,
            scheduled_publish_time: NOW_S + 660,
        })
    })

    it("fails with a contract mismatch when Meta answers without an id", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({}))

        await expect(
            client.schedulePagePost(PAGE, { message: "Hi", imageUrls: [], publishAt: new Date(NOW) }),
        ).rejects.toMatchObject({ code: MetaErrorCode.ContractMismatch })
    })
})

describe("MetaPublishingClient / pageInsights", () => {
    it("merges the daily reach and engagements by day, oldest first", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(
            answer({
                data: [
                    {
                        name: "page_impressions_unique",
                        values: [
                            { value: 120, end_time: "2026-10-14T07:00:00+0000" },
                            { value: 100, end_time: "2026-10-13T07:00:00+0000" },
                            { value: 5 },
                        ],
                    },
                    {
                        name: "page_post_engagements",
                        values: [
                            { value: 9, end_time: "2026-10-13T07:00:00+0000" },
                            { value: "x", end_time: "2026-10-15T07:00:00+0000" },
                        ],
                    },
                    { name: "other", values: [{ value: 1, end_time: "2026-10-13T07:00:00+0000" }] },
                ],
            }),
        )

        await expect(client.pageInsights(PAGE, "2026-10-12", "2026-10-19")).resolves.toEqual([
            { day: "2026-10-12", reach: 100, engagements: 9 },
            { day: "2026-10-13", reach: 120, engagements: 0 },
            { day: "2026-10-14", reach: 0, engagements: 0 },
        ])
        const url = new URL(String(http.request.mock.calls[0]?.[0].url))
        expect(url.searchParams.get("metric")).toBe("page_impressions_unique,page_post_engagements")
        expect(url.searchParams.get("since")).toBe("2026-10-12")
    })

    it("answers no days when Meta sends no data", async () => {
        const { client, http } = await build()
        http.request.mockResolvedValueOnce(answer({ data: "none" }))

        await expect(client.pageInsights(PAGE, "2026-10-12", "2026-10-19")).resolves.toEqual([])
    })
})
