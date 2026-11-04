import { Injectable } from "@nestjs/common"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { isRecord } from "@modules/platform/primitives"
import { ZaloError, ZaloErrorCode } from "./errors/zalo.error"
import { InjectZaloOptions } from "./zalo.decorators"
import { RENEWAL_GRANT_FIELD } from "./zalo.contracts"
import type { ZaloChatMessage, ZaloData, ZaloMethod, ZaloTokens, ZnsMessage, ZnsReceipt } from "./zalo.contracts"
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

/** The most chats or messages one OA list call reads (one Zalo page). */
const CHAT_PAGE_LIMIT = 10

/** A string or number field of a row as text, or an empty text. */
const scalarOf = (row: Record<string, unknown>, key: string): string => {
    const value = row[key]
    return typeof value === "string" || typeof value === "number" ? String(value) : ""
}

/** One row of a chat list: src 1 is the customer writing, src 0 the OA; null when it lacks the id, the customer or the time. */
const chatMessageOf = (row: unknown): ZaloChatMessage | null => {
    if (!isRecord(row)) return null
    const fromUser = row.src === 1
    const userId = scalarOf(row, fromUser ? "from_id" : "to_id")
    const messageId = scalarOf(row, "message_id")
    const sentAt = row.time
    if (messageId === "" || userId === "" || typeof sentAt !== "number" || !Number.isFinite(sentAt)) return null
    return {
        messageId,
        userId,
        userName: scalarOf(row, fromUser ? "from_display_name" : "to_display_name"),
        fromUser,
        kind: scalarOf(row, "type"),
        text: typeof row.message === "string" ? row.message : "",
        sentAt,
    }
}

/** The most characters of an error answer that travel in the params of an error. */
const BODY_LOG_LIMIT = 500

/** Keys whose value never travels in an error: a credential Zalo might echo back. */
const SECRET_KEY = /token|secret|password|authorization|code_verifier/iu

/** The path of a call without its query: the query names a customer or a page, and the path alone says which endpoint failed. */
const pathOf = (path: string): string => path.split("?")[0] ?? path

/** An error answer of Zalo as short text for the log, with every credential-looking field blanked, so the next failure says exactly what Zalo answered. */
const bodyTextOf = (body: unknown): string =>
    (JSON.stringify(body, (key, value: unknown) => (SECRET_KEY.test(key) ? "[redacted]" : value)) ?? "").slice(
        0,
        BODY_LOG_LIMIT,
    )

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
        await this.call(accessToken, "POST", CS_PATH, {
            recipient: { user_id: userId },
            message: { text },
        })
    }

    /**
     * Sends one image to a user as a consultation message: the OA v3 `media` template with a single image element that Zalo fetches from
     * the public https url. The same window rules as a text apply.
     */
    async sendCsImage(accessToken: string, userId: string, imageUrl: string): Promise<void> {
        await this.call(accessToken, "POST", CS_PATH, {
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
        const data = await this.call(
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
        const data = await this.call(
            accessToken,
            "GET",
            `/v3.0/oa/user/detail?data=${encodeURIComponent(JSON.stringify({ user_id: userId }))}`,
        )
        const name = data.display_name ?? data.user_alias
        return typeof name === "string" ? name.trim() : ""
    }

    /**
     * The OA's recent chats (Open API v2.0 `listrecentchat`): the newest message of each conversation, newest first, `count` at most ten per
     * call from `offset`. A row the answer cannot read is left out.
     */
    recentChats(
        accessToken: string,
        offset: number,
        count: number = CHAT_PAGE_LIMIT,
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        return this.chatRows(accessToken, "/v2.0/oa/listrecentchat", { offset, count })
    }

    /** The messages of one customer's conversation with the OA (Open API v2.0 `conversation`), newest first, `count` at most ten per call from `offset`. */
    conversation(
        accessToken: string,
        userId: string,
        offset: number,
        count: number = CHAT_PAGE_LIMIT,
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        return this.chatRows(accessToken, "/v2.0/oa/conversation", { user_id: userId, offset, count })
    }

    private async chatRows(
        accessToken: string,
        path: string,
        query: Record<string, string | number>,
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        const rows = await this.apiData(accessToken, "GET", `${path}?data=${encodeURIComponent(JSON.stringify(query))}`)
        return (Array.isArray(rows) ? rows : []).flatMap((row: unknown) => {
            const message = chatMessageOf(row)
            return message === null ? [] : [message]
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
                    status: answer.status,
                    body: bodyTextOf(body),
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

    /** Calls an endpoint of the OA API with the access token and answers the `data` of a successful answer as an object; any failure is a ZaloError. */
    async call(
        accessToken: string,
        method: ZaloMethod,
        path: string,
        body?: unknown,
        base: string = this.options.apiBase,
    ): Promise<ZaloData> {
        const data = await this.apiData(accessToken, method, path, body, base)
        return isRecord(data) ? data : {}
    }

    /** The `data` of a successful answer as Zalo sent it: an object for most calls, a list for the chat lists. */
    private async apiData(
        accessToken: string,
        method: "GET" | "POST",
        path: string,
        body?: unknown,
        base: string = this.options.apiBase,
    ): Promise<unknown> {
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
                code: ZaloErrorCode.Unavailable,
                params: {
                    path: pathOf(path),
                    reason: `HTTP ${answer.status}`,
                    status: answer.status,
                    body: bodyTextOf(answer.body),
                },
            })
        }
        const failure = answer.body.error
        if (typeof failure === "number" && failure !== 0) {
            throw new ZaloError({
                code: zaloErrorCodeOf(failure),
                params: {
                    path: pathOf(path),
                    reason: this.reasonOf(answer.body, answer.status),
                    zaloCode: failure,
                    status: answer.status,
                    body: bodyTextOf(answer.body),
                },
            })
        }
        if (((path === CS_PATH || path === ZNS_PATH) && failure !== 0) || answer.status < 200 || answer.status >= 300) {
            throw new ZaloError({
                code: ZaloErrorCode.Unavailable,
                params: {
                    path: pathOf(path),
                    reason: `HTTP ${answer.status}`,
                    status: answer.status,
                    body: bodyTextOf(answer.body),
                },
            })
        }
        return answer.body.data
    }

    private reasonOf(body: Record<string, unknown>, status: number): string {
        const text = [body.error_description, body.error_reason, body.error_name, body.message].find(
            (value): value is string => typeof value === "string" && value !== "",
        )
        return text ?? String(status)
    }
}
