import { MetaMessagingClient } from "./meta-messaging.client"
import { Injectable } from "@nestjs/common"
import { MetaLogEvent } from "./meta.log-events"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { INSTAGRAM_FIELDS, PAGE_FIELDS, PAGE_REQUESTS_MAX } from "./meta.contracts"
import type {
    AppSubscriptionResult,
    MetaEvent,
    MetaLead,
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
} from "./meta.contracts"
import type { MetaApp } from "./meta.options"
import { authorizeUrl, isPublicSite, redirectUri, webhookUrl } from "./meta-url.policy"
import { metaStateKey, signMetaState, verifyMetaState } from "./meta-state.policy"
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
export class MetaClient extends MetaMessagingClient {
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
            this.logger.error(MetaLogEvent.LongLivedUnavailable, cause)
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
}
