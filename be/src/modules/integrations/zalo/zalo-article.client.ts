import { Injectable } from "@nestjs/common"
import { isRecord } from "@modules/platform/primitives"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { InjectZalo } from "./zalo.decorators"
import type { ZaloClient } from "./zalo.client"
import type { ZaloArticle, ZaloArticleStats } from "./zalo.contracts"

/** The most articles one list call reads (one Zalo page). */
const ARTICLES_LIMIT = 50

const numberOf = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0)

/** The article fields Zalo takes on create and on update. */
const articleBody = (article: ZaloArticle): Record<string, unknown> => ({
    type: "normal",
    title: article.title.slice(0, 150),
    author: article.author.slice(0, 50),
    cover: { cover_type: "photo", photo_url: article.coverUrl, status: "show" },
    description: article.description.slice(0, 300),
    body: article.paragraphs.map((content) => ({ type: "text", content })),
    status: article.publish ? "show" : "hide",
    comment: "show",
})

/** One row of the article list, or null when it has no id or no creation time. */
const statsOf = (row: unknown): ZaloArticleStats | null => {
    if (!isRecord(row) || typeof row.id !== "string" || row.id === "") return null
    if (typeof row.create_date !== "number" || !Number.isFinite(row.create_date)) return null
    return {
        id: row.id,
        title: typeof row.title === "string" ? row.title : "",
        status: typeof row.status === "string" ? row.status : "",
        createdAt: new Date(row.create_date).toISOString(),
        views: numberOf(row.total_view),
        shares: numberOf(row.total_share),
    }
}

@Injectable()
/** The OA articles (Zalo Article API v2.0), written over the calls of the Zalo client, which owns the wire and its failures. */
export class ZaloArticleClient {
    constructor(@InjectZalo() private readonly zalo: ZaloClient) {}

    /**
     * Creates an OA article: a cover photo, the description and the body paragraphs. `status: "hide"` keeps it
     * unpublished until the scheduled moment. Answers the creation token Zalo gives to verify the article id later.
     */
    async create(accessToken: string, article: ZaloArticle): Promise<string> {
        const data = await this.zalo.call(accessToken, "POST", "/v2.0/article/create", articleBody(article))
        if (typeof data.token !== "string" || data.token === "") {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v2.0/article/create", reason: "no token" },
            })
        }
        return data.token
    }

    /**
     * Publishes an article created hidden: the creation token is verified into the article id, then the article is updated with
     * the same content and `status: "show"` (the Article API has no publish time, so the scheduler calls this when the post is due).
     * Answers the article id.
     */
    async publish(accessToken: string, articleToken: string, article: ZaloArticle): Promise<string> {
        const verified = await this.zalo.call(accessToken, "POST", "/v2.0/article/verify", { token: articleToken })
        const id = verified.id
        if (typeof id !== "string" || id === "") {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v2.0/article/verify", reason: "no id" },
            })
        }
        await this.zalo.call(accessToken, "POST", "/v2.0/article/update", {
            id,
            ...articleBody({ ...article, publish: true }),
        })
        return id
    }

    /** The newest OA articles (at most fifty) with the views and shares Zalo counted for each. */
    async list(accessToken: string): Promise<ReadonlyArray<ZaloArticleStats>> {
        const data = await this.zalo.call(
            accessToken,
            "GET",
            `/v2.0/article/getslice?offset=0&limit=${ARTICLES_LIMIT}&type=normal`,
        )
        const rows = Array.isArray(data.medias) ? data.medias : []
        return rows.flatMap((row) => {
            const stats = statsOf(row)
            return stats === null ? [] : [stats]
        })
    }
}
