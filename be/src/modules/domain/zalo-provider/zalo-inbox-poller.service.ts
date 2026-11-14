import { Injectable } from "@nestjs/common"
import {
    PollLimiterService,
    type PollFailure,
    type PollLimits,
    type PollPage,
    type PollWindow,
} from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { MessageInboxPoller } from "@modules/domain/provider-registry"
import { InjectZalo, ZaloError, ZaloErrorCode, type ZaloChatMessage, type ZaloClient } from "@modules/integrations/zalo"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectZaloAccessTokens, type ZaloAccessTokens } from "./zalo-access-tokens.port"
import { InjectZaloProviderOptions } from "./zalo-provider.decorators"
import type { ZaloProviderOptions } from "./zalo-provider.options"
import { ZALO_PLAN_LACKS_READING_NOTICE } from "./messages/zalo-provider.messages"
import {
    ZALO_POLL_MAX_PAGES,
    ZALO_POLL_PAGE_SIZE,
    isStaleMessage,
    pollRulesOf,
    type ZaloPollRules,
} from "./zalo-poll.policy"

/** The number Zalo answers when the OA tier package does not include the feature ("The OA needs to upgrade OA Tier Package to use this feature"). */
const PLAN_LACKS_FEATURE = -224

/** Reads one page of a chat list from an offset. */
type ChatReader = (offset: number) => Promise<ReadonlyArray<ZaloChatMessage>>

/** One customer text the poll read back, with whether it is too old for an agent to answer (past the reply window or the stale age). */
export interface PolledZaloItem extends ZaloChatMessage {
    /** True when the message goes to the owner and no agent answers it. */
    readonly stale: boolean
}

@Injectable()
/**
 * Reads the customer messages of a Zalo OA connection with its access token: the recent chats name the conversations that moved inside the window,
 * then each conversation is read newest first. Answers what the customers wrote as one page (Zalo lists ten rows per call, so the walk over the
 * calls is bounded here, and every call takes a token of the connection's bucket), each text message marked stale or not. It stores nothing:
 * the intake keeps each one as the event the webhook would have made of it (the poll is the message trigger's reconcile, one trigger).
 */
export class ZaloInboxPollerService implements MessageInboxPoller<PolledZaloItem> {
    readonly provider = "zalo_oa"
    /**
     * Zalo publishes no rate for the OA open API: until it does, one OA gets two calls a second, a burst of four and two connections reading at once,
     * which is gentler than the 400 ms pause the first version slept between calls.
     */
    readonly limits: PollLimits = { ratePerSecond: 2, burst: 4, concurrency: 2 }
    private readonly rules: ZaloPollRules

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectZaloProviderOptions() options: ZaloProviderOptions,
        @InjectZaloAccessTokens() private readonly tokens: ZaloAccessTokens,
        private readonly limiter: PollLimiterService,
    ) {
        this.rules = pollRulesOf(options)
    }

    /** Reads the window; a connection without a usable credential or an access token is left out, not failed. */
    async fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledZaloItem>> {
        const access = await this.tokens.tokenOf(connection.id)
        if (access.kind === "skipped") return { kind: "skipped", reason: access.reason }
        const written = await this.writtenIn(access.token, connection.id, window)
        const times = written.map((message) => message.sentAt)
        const now = this.clock.now().getTime()
        return {
            kind: "page",
            items: written
                .filter((message) => message.kind === "text" && message.text.trim() !== "")
                .map((message) => ({ ...message, stale: isStaleMessage(message.sentAt, now, this.rules) })),
            fetched: written.length,
            oldestAt: written.length === 0 ? undefined : new Date(Math.min(...times)),
            newestAt: written.length === 0 ? undefined : new Date(Math.max(...times)),
        }
    }

    /**
     * Classifies a failure: an OA tier package that lacks the feature (-224) is no failure but a capability the plan does not give; Zalo refusing the access token, or the refresh of it, or the connection needing the owner (as the token port reads its own failures) is a bad credential, and Zalo saying the app or OA
     * lacks a permission is an auth failure the owner must fix by connecting again and granting message reading; an exhausted quota asks to slow
     * down (Zalo names no wait, so the backoff decides); an unreachable Zalo or a busy token refresh is worth retrying; anything else is given up on.
     */
    classify(error: unknown): PollFailure {
        if (error instanceof ZaloError) return this.classifyZalo(error)
        return this.tokens.failureOf(error) ?? { kind: "fatal" }
    }

    private classifyZalo(error: ZaloError): PollFailure {
        if (error.params.zaloCode === PLAN_LACKS_FEATURE) {
            return { kind: "unavailable", reason: "plan", notice: ZALO_PLAN_LACKS_READING_NOTICE }
        }
        if (error.code === ZaloErrorCode.TokenRejected || error.code === ZaloErrorCode.TokenRefreshRefused)
            return { kind: "auth_failed", reason: "credential" }
        if (error.code === ZaloErrorCode.NotPermitted) {
            return { kind: "auth_failed", reason: "permission" }
        }
        if (error.code === ZaloErrorCode.QuotaExhausted) return { kind: "rate_limited", retryAfterSeconds: 0 }
        return error.code === ZaloErrorCode.Unavailable ? { kind: "transient" } : { kind: "fatal" }
    }

    /** What the customers wrote inside the window, of any kind, from the conversations that moved. */
    private async writtenIn(
        accessToken: string,
        connectionId: string,
        window: PollWindow,
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        const recent = await this.readBack(connectionId, (offset) => this.zalo.recentChats(accessToken, offset), window)
        const users = [...new Set(recent.map((chat) => chat.userId))]
        const written: Array<ZaloChatMessage> = []
        await eachInOrder(users, async (userId) => {
            const chat = await this.readBack(
                connectionId,
                (offset) => this.zalo.conversation(accessToken, userId, offset),
                window,
            )
            written.push(...chat.filter((message) => message.fromUser))
        })
        return written
    }

    /** Pages one chat list from the newest back while its rows reach the window; stops at a short page or the page limit. */
    private async readBack(
        connectionId: string,
        read: ChatReader,
        window: PollWindow,
        offset = 0,
        collected: ReadonlyArray<ZaloChatMessage> = [],
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        if (offset >= ZALO_POLL_MAX_PAGES * ZALO_POLL_PAGE_SIZE) return collected
        await this.limiter.pass(this.provider, connectionId, this.limits)
        const rows = await read(offset)
        const from = window.from.getTime()
        const to = window.to?.getTime() ?? Number.POSITIVE_INFINITY
        const all = [...collected, ...rows.filter((row) => row.sentAt >= from && row.sentAt <= to)]
        const oldest = rows.at(-1)
        const reachedBack = rows.length < ZALO_POLL_PAGE_SIZE || (oldest !== undefined && oldest.sentAt < from)
        return reachedBack ? all : this.readBack(connectionId, read, window, offset + ZALO_POLL_PAGE_SIZE, all)
    }
}
