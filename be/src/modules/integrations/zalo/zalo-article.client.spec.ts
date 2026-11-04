import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ZaloErrorCode } from "./errors/zalo.error"
import { ZaloArticleClient } from "./zalo-article.client"
import type { ZaloClient } from "./zalo.client"
import { ZALO } from "./zalo.decorators"

const article = {
    title: "A weekend",
    author: "HAKUEN",
    coverUrl: "https://x/cover.png",
    description: "Offer",
    paragraphs: ["Paragraph 1", "Paragraph 2"],
    publish: false,
}

const build = async () => {
    const zalo = mock<ZaloClient>()
    const moduleRef = await Test.createTestingModule({
        providers: [ZaloArticleClient, { provide: ZALO, useValue: zalo }],
    }).compile()
    return { client: moduleRef.get(ZaloArticleClient), zalo }
}

describe("ZaloArticleClient create", () => {
    it("creates a hidden article with the cover and paragraphs and answers its token", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({ token: "tok-1" })

        await expect(client.create("access", article)).resolves.toBe("tok-1")

        expect(zalo.call).toHaveBeenCalledWith("access", "POST", "/v2.0/article/create", {
            type: "normal",
            title: "A weekend",
            author: "HAKUEN",
            cover: { cover_type: "photo", photo_url: "https://x/cover.png", status: "show" },
            description: "Offer",
            body: [
                { type: "text", content: "Paragraph 1" },
                { type: "text", content: "Paragraph 2" },
            ],
            status: "hide",
            comment: "show",
        })
    })

    it("shows the article when asked to publish", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({ token: "tok-2" })

        await client.create("access", { ...article, publish: true })

        expect(zalo.call.mock.calls[0]?.[3]).toMatchObject({ status: "show" })
    })

    it("is a rejection when Zalo answers without a token", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({})

        await expect(client.create("access", article)).rejects.toMatchObject({ code: ZaloErrorCode.Rejected })
    })
})

describe("ZaloArticleClient publish", () => {
    it("verifies the creation token into the article id and shows the article with the same content", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({ id: "art-1" }).mockResolvedValueOnce({ token: "tok-9" })

        await expect(client.publish("access", "tok-1", article)).resolves.toBe("art-1")

        expect(zalo.call.mock.calls[0]).toEqual(["access", "POST", "/v2.0/article/verify", { token: "tok-1" }])
        expect(zalo.call.mock.calls[1]?.slice(0, 3)).toEqual(["access", "POST", "/v2.0/article/update"])
        expect(zalo.call.mock.calls[1]?.[3]).toMatchObject({
            id: "art-1",
            status: "show",
            title: "A weekend",
            type: "normal",
        })
    })

    it("is a rejection when the token verifies to no article", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({})

        await expect(client.publish("access", "tok-1", article)).rejects.toMatchObject({
            code: ZaloErrorCode.Rejected,
        })
        expect(zalo.call).toHaveBeenCalledTimes(1)
    })
})

describe("ZaloArticleClient list", () => {
    it("reads the newest articles with their views and shares, leaving out unreadable rows", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({
            medias: [
                {
                    id: "art-1",
                    title: "A weekend",
                    status: "show",
                    create_date: Date.parse("2026-10-17T02:00:00.000Z"),
                    total_view: 120,
                    total_share: 4,
                },
                { id: "art-2", create_date: Date.parse("2026-10-16T02:00:00.000Z") },
                { id: "art-3", create_date: Number.NaN },
                { id: "art-4" },
                { id: "" },
                "noise",
            ],
        })

        await expect(client.list("access")).resolves.toEqual([
            {
                id: "art-1",
                title: "A weekend",
                status: "show",
                createdAt: "2026-10-17T02:00:00.000Z",
                views: 120,
                shares: 4,
            },
            { id: "art-2", title: "", status: "", createdAt: "2026-10-16T02:00:00.000Z", views: 0, shares: 0 },
        ])
        expect(zalo.call).toHaveBeenCalledWith("access", "GET", "/v2.0/article/getslice?offset=0&limit=50&type=normal")
    })

    it("answers no articles when Zalo lists none", async () => {
        const { client, zalo } = await build()
        zalo.call.mockResolvedValueOnce({})

        await expect(client.list("access")).resolves.toEqual([])
    })
})
