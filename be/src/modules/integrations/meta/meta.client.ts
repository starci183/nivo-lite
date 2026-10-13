import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaLogEvent } from "./meta.log-events"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { HOUR_MS, INSTAGRAM_FIELDS, PAGE_FIELDS, PAGE_REQUESTS_MAX, PRIVATE_REPLIES_PER_HOUR } from "./meta.contracts"
import type {
    AppSubscriptionResult,
    GraphCall,
    GraphResult,
    MessageTag,
    MetaEvent,
    MetaFailure,
    MetaLead,
    MetaPageAccess,
    MetaPageChoice,
    MetaPlatform,
    MetaStateInput,
    MetaSubscriptionStatus,
    AppObject,
    MetaInstagramAccess,
    MetaMention,
    MetaPageCredentials,
    MetaPageToken,
    OptionalChallenge,
    OptionalMetaState,
    OptionalMetaUrl,
    OptionalProfileName,
    ReceivedText,
    SendVia,
    RateLimiter,
    SendResult,
} from "./meta.contracts"
import { InjectMetaOptions } from "./meta.decorators"
import type { MetaApp, MetaOptions } from "./meta.options"
import { classifyGraphError } from "./meta-failure.policy"
import { authorizeUrl, graphUrl, isPublicSite, redirectUri, webhookUrl } from "./meta-url.policy"
import { metaStateKey, signMetaState, verifyMetaState } from "./meta-state.policy"
import { chunkText, createRateLimiter } from "./meta-window.policy"
import { parseLead, parseWebhook, verifyChallenge, verifySignature } from "./meta-webhook.policy"
import type { HubQuery } from "./meta-webhook.policy"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const rows = (value: unknown): ReadonlyArray<Json> => (Array.isArray(value) ? value.filter(isJson) : [])

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

const isText = (value: unknown): value is string => typeof value === "string"

/** The Page a `me/accounts` row names, when it carries an id and a Page token. */
const pageChoicesOf = (row: Json): Array<MetaPageChoice> => {
    const id = textOf(row.id)
    const token = textOf(row.access_token)
    if (!id || !token) return []
    const ig = isJson(row.instagram_business_account) ? row.instagram_business_account : {}
    const igId = textOf(ig.id)
    return [
        {
            id,
            name: textOf(row.name) ?? id,
            category: textOf(row.category) ?? null,
            token,
            ig: igId ? { id: igId, username: textOf(ig.username) ?? null, name: textOf(ig.name) ?? null } : null,
        },
    ]
}

const missingOf = (want: ReadonlyArray<string>, have: ReadonlyArray<string>): Array<string> =>
    want.filter((field) => !have.includes(field))

@Injectable()
/** Talks to the Meta Graph API for the connections capability: login, Pages, webhook subscriptions, sends and lead reads. */
export class MetaClient {
    private readonly sendLimiter: RateLimiter
    private readonly privateReplyLimiter: RateLimiter

    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectMetaOptions() private readonly options: MetaOptions,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
    ) {
        this.sendLimiter = createRateLimiter(Math.max(1, options.sendPerMinute), 60_000)
        this.privateReplyLimiter = createRateLimiter(PRIVATE_REPLIES_PER_HOUR, HOUR_MS)
    }

    /** True when this deployment has a Meta app and a site url to return to. */
    isConfigured(): boolean {
        return this.options.app !== null && redirectUri(this.options) !== null
    }

    /** True when the webhook verify token is configured. */
    hasVerifyToken(): boolean {
        return (this.options.webhookVerifyToken?.reveal() ?? "").trim() !== ""
    }

    /** The OAuth redirect uri to register on the Meta app. */
    redirectUri(): OptionalMetaUrl {
        return redirectUri(this.options)
    }

    /** The one webhook url of the Meta app. */
    webhookUrl(): OptionalMetaUrl {
        return webhookUrl(this.options)
    }

    /** The Meta login url for a signed state, or null when Meta is not configured. */
    authUrl(state: string): OptionalMetaUrl {
        return authorizeUrl(this.options, state)
    }

    /** Signs a ten-minute OAuth state with the key derived from the channel token key. */
    sign(input: MetaStateInput): string {
        return signMetaState(metaStateKey(this.options.channelTokenKey.reveal()), input, this.clock.now().getTime())
    }

    /** The state of a callback when its signature is valid, it has not expired and it is a Meta one; otherwise null. */
    verify(value: ReceivedText): OptionalMetaState {
        return verifyMetaState(metaStateKey(this.options.channelTokenKey.reveal()), value, this.clock.now().getTime())
    }

    /** True when the header is the HMAC of the raw body under the app secret. */
    verifyDelivery(header: ReceivedText, rawBody: Buffer): boolean {
        return verifySignature(header, rawBody, this.options.app?.appSecret.reveal() ?? "")
    }

    /** The challenge to echo when a webhook verification request carries our verify token; otherwise null. */
    challenge(query: HubQuery): OptionalChallenge {
        return verifyChallenge(query, this.options.webhookVerifyToken?.reveal())
    }

    /** A webhook body as normalised events. */
    parse(body: unknown): Array<MetaEvent> {
        return parseWebhook(body, this.clock.now().getTime())
    }

    /** Code to short-lived user token to long-lived user token (about 60 days; the Page tokens made from it do not expire). */
    async exchangeCode(code: string): Promise<string> {
        const app = this.requireApp()
        const redirect = this.requireRedirect()
        const short = await this.graph("oauth/access_token", {
            params: { client_id: app.appId, client_secret: app.appSecret.reveal(), redirect_uri: redirect, code },
        })
        const shortToken = textOf(short.access_token)
        if (!shortToken) throw new MetaError({ code: MetaErrorCode.ContractMismatch })
        const long = await this.graph("oauth/access_token", {
            params: {
                grant_type: "fb_exchange_token",
                client_id: app.appId,
                client_secret: app.appSecret.reveal(),
                fb_exchange_token: shortToken,
            },
        }).catch((cause: unknown) => {
            this.logger.error(MetaLogEvent.LongTokenUnavailable, cause)
            return null
        })
        return textOf(long?.access_token) ?? shortToken
    }

    /** The Pages the user manages, with their Page tokens and linked Instagram professional account (follows paging, at most 200 Pages). */
    listPages(userToken: string): Promise<Array<MetaPageChoice>> {
        return this.pagesFrom(userToken, undefined, 1)
    }

    private async pagesFrom(
        userToken: string,
        after: string | undefined,
        request: number,
    ): Promise<Array<MetaPageChoice>> {
        const res = await this.graph("me/accounts", {
            token: userToken,
            params: {
                fields: "id,name,category,access_token,instagram_business_account{id,username,name}",
                limit: 50,
                ...(after ? { after } : {}),
            },
        })
        const pages = rows(res.data).flatMap(pageChoicesOf)
        const paging = isJson(res.paging) ? res.paging : {}
        const cursors = isJson(paging.cursors) ? paging.cursors : {}
        const next = paging.next ? textOf(cursors.after) : undefined
        if (!next || request >= PAGE_REQUESTS_MAX) return pages
        return [...pages, ...(await this.pagesFrom(userToken, next, request + 1))]
    }

    /** Subscribes the Page to the app's webhook fields: messages, messaging_postbacks, feed, leadgen. */
    async subscribePage(pageId: string, pageToken: string): Promise<void> {
        await this.graph(`${pageId}/subscribed_apps`, {
            token: pageToken,
            method: "POST",
            params: { subscribed_fields: PAGE_FIELDS.join(",") },
        })
    }

    /** Stops the Page from sending its events to the app. */
    async unsubscribePage(pageId: string, pageToken: string): Promise<void> {
        await this.graph(`${pageId}/subscribed_apps`, { token: pageToken, method: "DELETE" })
    }

    /**
     * Points the app's webhook (objects page and instagram) at this deployment with our verify token. Meta calls the url back to
     * verify it, so it needs the public https address; on localhost the owner of the Meta app sets it by hand in the dashboard.
     */
    async ensureAppSubscriptions(): Promise<AppSubscriptionResult> {
        const app = this.options.app
        const callback = this.webhookUrl()
        if (app === null) return { done: false, reason: "not_configured" }
        const verify = (this.options.webhookVerifyToken?.reveal() ?? "").trim()
        if (!verify) return { done: false, reason: "no_verify_token" }
        if (callback === null || !isPublicSite(this.options)) return { done: false, reason: "local" }
        const token = this.appToken(app)
        const base = { token, method: "POST" as const }
        await this.graph(`${app.appId}/subscriptions`, {
            ...base,
            params: {
                object: "page",
                callback_url: callback,
                fields: PAGE_FIELDS.join(","),
                verify_token: verify,
                include_values: true,
            },
        })
        await this.graph(`${app.appId}/subscriptions`, {
            ...base,
            params: {
                object: "instagram",
                callback_url: callback,
                fields: INSTAGRAM_FIELDS.join(","),
                verify_token: verify,
                include_values: true,
            },
        })
        return { done: true }
    }

    /** What Meta really has: the Page subscription (Page token) and the app subscription (app token). */
    async subscriptionStatus(page: MetaPageCredentials): Promise<MetaSubscriptionStatus> {
        const app = this.options.app
        const [pageRes, appRes] = await Promise.all([
            this.graph(`${page.pageId}/subscribed_apps`, { token: page.pageToken }),
            app === null
                ? Promise.resolve(null)
                : this.graph(`${app.appId}/subscriptions`, { token: this.appToken(app) }).catch((cause: unknown) => {
                      this.logger.error(MetaLogEvent.AppSubscriptionsUnavailable, cause)
                      return null
                  }),
        ])
        const subscribed = rows(pageRes.data)
        const ours = subscribed.find((row) => row.id === app?.appId) ?? (app === null ? subscribed[0] : undefined)
        const fields = Array.isArray(ours?.subscribed_fields) ? ours.subscribed_fields.filter(isText) : []
        const callback = this.webhookUrl()
        const objectOf = (object: string, want: ReadonlyArray<string>): AppObject | null => {
            const row = rows(appRes?.data).find((candidate) => candidate.object === object)
            if (!row) return null
            const have = rows(row.fields).map((field) => textOf(field.name) ?? "")
            const callbackUrl = textOf(row.callback_url) ?? ""
            return {
                callbackUrl,
                fields: have,
                missing: missingOf(want, have),
                urlMatches: callbackUrl === callback,
            }
        }
        return {
            page: { subscribed: ours !== undefined, fields, missing: missingOf(PAGE_FIELDS, fields) },
            app: appRes
                ? { page: objectOf("page", PAGE_FIELDS), instagram: objectOf("instagram", INSTAGRAM_FIELDS) }
                : null,
        }
    }

    /**
     * Sends `text` to a person (PSID / IGSID) of the Page as a response (or as a HUMAN_AGENT tagged message when `via` says so);
     * long text is split. The messaging window was checked by the caller. Never throws; the answer says why a send did not go.
     */
    deliverMessage(
        page: MetaPageAccess,
        platform: MetaPlatform,
        recipientId: string,
        text: string,
        via: SendVia,
    ): Promise<SendResult> {
        const refusal = this.precheck(page, platform, text)
        if (refusal) return Promise.resolve(refusal)
        return this.sendChunks(page, recipientId, via, chunkText(platform, text), 0, [])
    }

    /** Sends the parts one after another; a refused part or a spent send slot stops the rest. */
    private async sendChunks(
        page: MetaPageAccess,
        recipientId: string,
        via: SendVia,
        chunks: ReadonlyArray<string>,
        index: number,
        ids: ReadonlyArray<string>,
    ): Promise<SendResult> {
        const chunk = chunks[index]
        if (chunk === undefined) return { ok: true, ids: [...ids] }
        if (!this.sendLimiter.take(page.pageId, this.clock.now().getTime())) {
            return this.refuse("rate_limited", ids.length ? `sent ${ids.length} of ${chunks.length} parts` : undefined)
        }
        const res = await this.request(`${page.pageId}/messages`, {
            token: page.pageToken,
            method: "POST",
            body: {
                recipient: { id: recipientId },
                ...(via === "human_agent"
                    ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" satisfies MessageTag }
                    : { messaging_type: "RESPONSE" }),
                message: { text: chunk },
            },
        })
        if (!res.ok) return this.refuse(res.failure, res.detail)
        const id = textOf(res.body.message_id)
        return this.sendChunks(page, recipientId, via, chunks, index + 1, id ? [...ids, id] : ids)
    }

    /** A PUBLIC reply under a comment (everyone sees it). */
    async publicReply(
        page: MetaPageAccess,
        platform: MetaPlatform,
        commentId: string,
        text: string,
    ): Promise<SendResult> {
        const refusal = this.precheck(page, platform, text)
        if (refusal) return refusal
        if (!this.sendLimiter.take(page.pageId, this.clock.now().getTime())) return this.refuse("rate_limited")
        const res = await this.request(`${commentId}/${platform === "facebook" ? "comments" : "replies"}`, {
            token: page.pageToken,
            method: "POST",
            params: { message: text.trim().slice(0, platform === "facebook" ? 8000 : 2200) },
        })
        if (!res.ok) return this.refuse(res.failure, res.detail)
        const id = textOf(res.body.id)
        return { ok: true, ids: id ? [id] : [] }
    }

    /** Takes the hourly private-reply slot and a send slot of the Page; false when either is used up. */
    takePrivateReplySlots(pageId: string): boolean {
        const now = this.clock.now().getTime()
        return this.privateReplyLimiter.take(pageId, now) && this.sendLimiter.take(pageId, now)
    }

    /** A PRIVATE reply: a message to the commenter opened by the comment. The once-per-comment claim was made by the caller. */
    async privateMessage(
        page: MetaPageAccess,
        platform: MetaPlatform,
        commentId: string,
        text: string,
    ): Promise<SendResult> {
        const res = await this.request(`${page.pageId}/messages`, {
            token: page.pageToken,
            method: "POST",
            body: {
                recipient: { comment_id: commentId },
                message: { text: chunkText(platform, text)[0] ?? text.trim() },
            },
        })
        if (!res.ok) return this.refuse(res.failure, res.detail)
        const id = textOf(res.body.message_id)
        const recipient = textOf(res.body.recipient_id)
        return { ok: true, ids: id ? [id] : [], ...(recipient ? { recipientId: recipient } : {}) }
    }

    /** The answers of one lead-form submission (needs leads_retrieval and the Page token). */
    async fetchLead(page: MetaPageToken, leadgenId: string): Promise<MetaLead> {
        return parseLead(
            await this.graph(leadgenId, {
                token: page.pageToken,
                params: { fields: "id,created_time,ad_id,form_id,field_data" },
            }),
        )
    }

    /** The person's display name (Messenger: name; Instagram: name or username), or null when Meta does not give it. */
    async fetchProfileName(page: MetaPageToken, platform: MetaPlatform, userId: string): Promise<OptionalProfileName> {
        try {
            const res = await this.graph(userId, {
                token: page.pageToken,
                params: { fields: platform === "facebook" ? "name,first_name,last_name" : "name,username" },
                timeoutMs: 5000,
            })
            const full = [textOf(res.first_name), textOf(res.last_name)].filter(Boolean).join(" ").trim()
            return textOf(res.name)?.trim() || full || textOf(res.username)?.trim() || null
        } catch (cause) {
            this.logger.error(MetaLogEvent.ProfileUnavailable, cause)
            return null
        }
    }

    /** The text of an Instagram comment or caption that mentioned the account (the mentions webhook carries only ids). */
    async fetchMention(page: MetaInstagramAccess, commentId: string): Promise<MetaMention> {
        if (!page.igId) return { text: null, username: null }
        try {
            const res = await this.graph(page.igId, {
                token: page.pageToken,
                params: { fields: `mentioned_comment.comment_id(${commentId}){text,username}` },
                timeoutMs: 5000,
            })
            const mention = isJson(res.mentioned_comment) ? res.mentioned_comment : {}
            return { text: textOf(mention.text) ?? null, username: textOf(mention.username) ?? null }
        } catch (cause) {
            this.logger.error(MetaLogEvent.MentionUnavailable, cause)
            return { text: null, username: null }
        }
    }

    private requireApp(): MetaApp {
        if (this.options.app === null) throw new MetaError({ code: MetaErrorCode.NotConfigured })
        return this.options.app
    }

    private requireRedirect(): string {
        const redirect = redirectUri(this.options)
        if (redirect === null) throw new MetaError({ code: MetaErrorCode.NotConfigured })
        return redirect
    }

    private appToken(app: MetaApp): string {
        return `${app.appId}|${app.appSecret.reveal()}`
    }

    private precheck(page: MetaPageAccess, platform: MetaPlatform, text: string): SendResult | null {
        if (!text.trim()) return this.refuse("empty_text")
        if (platform === "instagram" && !page.igId)
            return this.refuse("not_connected", "no Instagram account linked to this Page")
        return null
    }

    private refuse(reason: MetaFailure, detail?: string): SendResult {
        return { ok: false, reason, ...(detail ? { detail } : {}) }
    }

    /** One Graph call that throws a MetaError (with the Graph classification) when Meta refuses or cannot be reached. */
    private async graph(path: string, call: GraphCall): Promise<Json> {
        const result = await this.request(path, call)
        if (result.ok) return result.body
        throw new MetaError(
            result.unreachable
                ? { code: MetaErrorCode.Unreachable, cause: result.cause }
                : {
                      code: MetaErrorCode.Refused,
                      params: { failure: result.failure, status: result.status },
                      cause: new Error(result.detail),
                  },
        )
    }

    /** One Graph call. The token travels as `access_token` (never logged); a failure is a value, never a throw. */
    private async request(path: string, call: GraphCall): Promise<GraphResult> {
        const url = graphUrl(this.options, path, {
            ...call.params,
            ...(call.token ? { access_token: call.token } : {}),
        })
        let response
        try {
            response = await this.http.request({
                method: call.method ?? "GET",
                url,
                ...(call.body === undefined ? {} : { body: call.body }),
                timeoutMs: call.timeoutMs ?? this.options.timeoutMs,
            })
        } catch (cause) {
            const detail = cause instanceof Error ? cause.message : "network error"
            return { ok: false, failure: "error", status: 0, detail, unreachable: true, cause }
        }
        const body = isJson(response.body) ? response.body : {}
        const failure = isJson(body.error) ? body.error : null
        if (response.status >= 200 && response.status < 300 && failure === null) return { ok: true, body }
        const detail = textOf(failure?.message) ?? `Graph ${response.status}`
        return {
            ok: false,
            failure: classifyGraphError({
                status: response.status,
                code: typeof failure?.code === "number" ? failure.code : null,
                subcode: typeof failure?.error_subcode === "number" ? failure.error_subcode : null,
                message: detail,
            }),
            status: response.status,
            detail,
            unreachable: false,
        }
    }
}
