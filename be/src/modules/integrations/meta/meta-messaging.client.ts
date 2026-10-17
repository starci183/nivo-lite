import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectHttpClient } from "@modules/platform/http"
import type { HttpClient } from "@modules/platform/http"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaError, MetaErrorCode } from "./errors/meta.error"
import { HOUR_MS, PRIVATE_REPLIES_PER_HOUR } from "./meta.contracts"
import type {
    GraphCall,
    GraphResult,
    MessageTag,
    MetaPageAccess,
    MetaPlatform,
    MetaFailure,
    RateLimiter,
    SendVia,
    SendResult,
} from "./meta.contracts"
import { InjectMetaOptions } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"
import { classifyGraphError } from "./meta-failure.policy"
import { graphUrl } from "./meta-url.policy"
import { chunkMessage, createRateLimiter } from "./meta-window.policy"

type Json = Readonly<Record<string, unknown>>

const isJson = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined)

@Injectable()
/** Sends Meta messages and comment replies through the shared Graph transport, with per-Page quotas. */
export class MetaMessagingClient {
    private readonly sendLimiter: RateLimiter
    private readonly privateReplyLimiter: RateLimiter

    constructor(
        @InjectHttpClient() private readonly http: HttpClient,
        @InjectMetaOptions() protected readonly options: MetaOptions,
        @InjectClock() protected readonly clock: Clock,
        @InjectLogger() protected readonly logger: Logger,
    ) {
        this.sendLimiter = createRateLimiter(Math.max(1, options.sendPerMinute), 60_000)
        this.privateReplyLimiter = createRateLimiter(PRIVATE_REPLIES_PER_HOUR, HOUR_MS)
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
        return this.sendChunks(page, recipientId, via, chunkMessage(platform, text), 0, [])
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
                message: { text: chunkMessage(platform, text)[0] ?? text.trim() },
            },
        })
        if (!res.ok) return this.refuse(res.failure, res.detail)
        const id = textOf(res.body.message_id)
        const recipient = textOf(res.body.recipient_id)
        return { ok: true, ids: id ? [id] : [], ...(recipient ? { recipientId: recipient } : {}) }
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
    protected async graph(path: string, call: GraphCall): Promise<Json> {
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
