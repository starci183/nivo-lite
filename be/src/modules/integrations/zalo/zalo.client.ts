import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { InjectZaloOptions } from "./zalo.decorators"
import { RENEWAL_GRANT_FIELD } from "./zalo.contracts"
import type { ZaloArticle, ZaloArticleStats, ZaloTokens, ZnsMessage, ZnsReceipt } from "./zalo.contracts"
import type { ZaloOptions } from "./zalo.options"
import { zaloErrorCodeOf } from "./zalo-failure.policy"
import { challengeOf } from "./zalo-oauth.policy"

/** Lifetime from the Zalo docs when the answer gives none: the access token lives 1 hour. */
const ACCESS_FALLBACK_SECONDS = 3600

const TOKEN_PATH = "/v4/oa/access_token"

/** The OA v3 consultation message path: text and attachments alike. */
const CS_PATH = "/v3.0/oa/message/cs"

/** The ZNS template message path of the business host. */
const ZNS_PATH = "/message/template"

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
/** The one place that talks to Zalo. Nothing here reads the database or logs a secret. */
export class ZaloClient {
    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectZaloOptions() private readonly options: ZaloOptions,
    ) {}

    /** The URL the owner opens to grant the OA permissions (PKCE: the challenge is the S256 of the verifier). */
    authorizeUrl(appId: string, redirectUri: string, verifier: string, state: string): string {
        const query = new URLSearchParams({
            app_id: appId,
            redirect_uri: redirectUri,
            code_challenge: challengeOf(verifier),
            state,
        })
        return `${this.options.oauthBase}/v4/oa/permission?${query.toString()}`
    }

    /** Exchanges the authorization code for the first tokens of the OA. */
    exchangeCode(appId: string, appSecret: string, code: string, verifier: string): Promise<ZaloTokens> {
        return this.tokenCall(appSecret, {
            code,
            app_id: appId,
            grant_type: "authorization_code",
            code_verifier: verifier,
        })
    }

    /** Spends the single-use refresh token for a new pair. */
    refreshTokens(appId: string, appSecret: string, renewalToken: string): Promise<ZaloTokens> {
        return this.tokenCall(appSecret, {
            [RENEWAL_GRANT_FIELD]: renewalToken,
            app_id: appId,
            grant_type: "refresh_token",
        })
    }

    /** Sends a consultation (CS) text message to one user; a refusal is a ZaloError carrying Zalo's numeric error. */
    async sendCsText(accessToken: string, userId: string, text: string): Promise<void> {
        await this.apiCall(accessToken, "POST", CS_PATH, {
            recipient: { user_id: userId },
            message: { text },
        })
    }

    /**
     * Sends one image to a user as a consultation message: the OA v3 `media` template with a single image element that Zalo fetches from
     * the public https url. The same window rules as a text apply.
     */
    async sendCsImage(accessToken: string, userId: string, imageUrl: string): Promise<void> {
        await this.apiCall(accessToken, "POST", CS_PATH, {
            recipient: { user_id: userId },
            message: {
                attachment: {
                    type: "template",
                    payload: { template_type: "media", elements: [{ media_type: "image", url: imageUrl }] },
                },
            },
        })
    }

    /**
     * Sends one Zalo Notification Service message: an approved template filled for a phone, authorised by the OA access token. It reaches
     * the customer whether or not they wrote to the OA lately, and Zalo charges the OA for it. Answers Zalo's message id.
     */
    async sendZns(accessToken: string, message: ZnsMessage): Promise<ZnsReceipt> {
        const data = await this.apiCall(
            accessToken,
            "POST",
            ZNS_PATH,
            {
                phone: message.phone,
                template_id: message.templateId,
                template_data: message.templateData,
                tracking_id: message.trackingId,
            },
            this.options.businessBase,
        )
        return { messageId: typeof data.msg_id === "string" ? data.msg_id : "" }
    }

    /** The customer's display name, or an empty text when Zalo does not say: the name only labels the conversation. */
    async userDisplayName(accessToken: string, userId: string): Promise<string> {
        const data = await this.apiCall(
            accessToken,
            "GET",
            `/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`,
        )
        const name = data.display_name ?? data.user_alias
        return typeof name === "string" ? name.trim() : ""
    }

    /**
     * Creates an OA article (Zalo Article API v2.0): a cover photo, the description and the body paragraphs. `status: "hide"` keeps it
     * unpublished until the scheduled moment. Answers the creation token Zalo gives to verify the article id later.
     */
    async createArticle(accessToken: string, article: ZaloArticle): Promise<string> {
        const data = await this.apiCall(accessToken, "POST", "/v2.0/article/create", articleBody(article))
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
    async publishArticle(accessToken: string, articleToken: string, article: ZaloArticle): Promise<string> {
        const verified = await this.apiCall(accessToken, "POST", "/v2.0/article/verify", { token: articleToken })
        const id = verified.id
        if (typeof id !== "string" || id === "") {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path: "/v2.0/article/verify", reason: "no id" },
            })
        }
        await this.apiCall(accessToken, "POST", "/v2.0/article/update", {
            id,
            ...articleBody({ ...article, publish: true }),
        })
        return id
    }

    /** The newest OA articles (at most fifty) with the views and shares Zalo counted for each. */
    async articles(accessToken: string): Promise<ReadonlyArray<ZaloArticleStats>> {
        const data = await this.apiCall(
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

    private async tokenCall(secret: string, form: Record<string, string>): Promise<ZaloTokens> {
        const answer = await this.http
            .request({
                method: "POST",
                url: `${this.options.oauthBase}${TOKEN_PATH}`,
                headers: { secret_key: secret },
                form,
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new ZaloError({ code: ZaloErrorCode.Unavailable, cause })
            })
        const body = isRecord(answer.body) ? answer.body : {}
        const accessToken = body.access_token
        const renewalToken = body[RENEWAL_GRANT_FIELD]
        if (typeof accessToken !== "string" || typeof renewalToken !== "string" || !accessToken || !renewalToken) {
            const code = Number(body.error)
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: {
                    path: TOKEN_PATH,
                    reason: this.reasonOf(body, answer.status),
                    ...(Number.isFinite(code) ? { zaloCode: code } : {}),
                },
            })
        }
        const seconds = Number(body.expires_in)
        return {
            accessToken,
            renewalToken,
            expiresInSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : ACCESS_FALLBACK_SECONDS,
        }
    }

    private async apiCall(
        accessToken: string,
        method: "GET" | "POST",
        path: string,
        body?: unknown,
        base: string = this.options.apiBase,
    ): Promise<Record<string, unknown>> {
        const answer = await this.http
            .request({
                method,
                url: `${base}${path}`,
                headers: { access_token: accessToken },
                ...(body === undefined ? {} : { body }),
                timeoutMs: this.options.timeoutMs,
            })
            .catch((cause: unknown) => {
                throw new ZaloError({ code: ZaloErrorCode.Unavailable, cause })
            })
        if (!isRecord(answer.body)) {
            throw new ZaloError({
                code: ZaloErrorCode.Rejected,
                params: { path, reason: `HTTP ${answer.status}` },
            })
        }
        const failure = answer.body.error
        if (typeof failure === "number" && failure !== 0) {
            throw new ZaloError({
                code: zaloErrorCodeOf(failure),
                params: { path, reason: this.reasonOf(answer.body, answer.status), zaloCode: failure },
            })
        }
        return isRecord(answer.body.data) ? answer.body.data : {}
    }

    private reasonOf(body: Record<string, unknown>, status: number): string {
        const text = [body.error_description, body.error_reason, body.error_name, body.message].find(
            (value): value is string => typeof value === "string" && value !== "",
        )
        return text ?? String(status)
    }
}
