import { Injectable } from "@nestjs/common"
import { ChannelsError, ChannelsErrorCode, ZaloCredentialsService } from "@modules/domain/channels"
import { PollLimiterService } from "@modules/domain/connection-poll"
import type { PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { MessageInboxPoller } from "@modules/domain/provider-registry"
import { ZaloInboxService } from "@modules/domain/zalo-inbox"
import { InjectZalo, ZaloError, ZaloErrorCode } from "@modules/integrations/zalo"
import type { ZaloChatMessage, ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectZaloProviderOptions } from "./zalo-provider.decorators"
import type { ZaloProviderOptions } from "./zalo-provider.options"
import { ZALO_PLAN_LACKS_READING_NOTICE } from "./messages/zalo-provider.messages"
import { ZALO_POLL_MAX_PAGES, ZALO_POLL_PAGE_SIZE, isStaleMessage, pollRulesOf } from "./zalo-poll.policy"
import type { ZaloPollRules } from "./zalo-poll.policy"

/** The number Zalo answers when the OA tier package does not include the feature ("The OA needs to upgrade OA Tier Package to use this feature"). */
const PLAN_LACKS_FEATURE = -224

/** What Zalo says in its own words when the app or the OA lacks a permission or a scope (the numeric codes of that refusal are not in a table we can read). */
const MISSING_PERMISSION = /permission|scope|quy[ềe]n/iu

/** Reads one page of a chat list from an offset. */
type ChatReader = (offset: number) => Promise<ReadonlyArray<ZaloChatMessage>>

@Injectable()
/**
 * Reads the customer messages of a Zalo OA connection with its access token: the recent chats name the conversations that moved inside the window,
 * then each conversation is read newest first. Answers what the customers wrote as one page (Zalo lists ten rows per call, so the walk over the
 * calls is bounded here, and every call takes a token of the connection's bucket), and stores each text message through the inbox under the
 * delivery id of the webhook.
 */
export class ZaloInboxPoller implements MessageInboxPoller<ZaloChatMessage> {
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
        private readonly credentials: ZaloCredentialsService,
        private readonly inbox: ZaloInboxService,
        private readonly limiter: PollLimiterService,
    ) {
        this.rules = pollRulesOf(options)
    }

    /** Reads the window; a connection without a usable credential or an access token is left out, not failed. */
    async fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<ZaloChatMessage>> {
        const loaded = await this.credentials.load(connection.id)
        if (loaded.kind !== "ok") return { kind: "skipped", reason: "not_ready" }
        if (loaded.value.secret.accessToken === undefined) return { kind: "skipped", reason: "no_token" }
        const accessToken = await this.credentials.accessToken(connection.id)
        const written = await this.writtenIn(accessToken, connection.id, window)
        const times = written.map((message) => message.sentAt)
        return {
            kind: "page",
            items: written.filter((message) => message.kind === "text" && message.text.trim() !== ""),
            fetched: written.length,
            oldestAt: written.length === 0 ? undefined : new Date(Math.min(...times)),
            newestAt: written.length === 0 ? undefined : new Date(Math.max(...times)),
        }
    }

    /**
     * Hands the message to the inbox the webhook feeds; false when the webhook (or an earlier poll) already did. A message past the reply window or
     * the stale age is kept for the owner and no agent answers it.
     */
    store(connection: ConnectionRecord, item: ZaloChatMessage): Promise<boolean> {
        const stale = isStaleMessage(item.sentAt, this.clock.now().getTime(), this.rules)
        return this.inbox.acceptPolledMessage(
            connection.id,
            { messageId: item.messageId, userId: item.userId, text: item.text, sentAt: item.sentAt },
            { workspaceId: connection.workspaceId, sender: item.userName || item.userId, stale },
        )
    }

    /**
     * Classifies a failure: an OA tier package that lacks the feature (-224) is no failure but a capability the plan does not give; Zalo refusing the access token or the connection needing the owner is a bad credential, and Zalo saying the app or OA
     * lacks a permission is an auth failure the owner must fix by connecting again and granting message reading; an exhausted quota asks to slow
     * down (Zalo names no wait, so the backoff decides); an unreachable Zalo or a busy token refresh is worth retrying; anything else is given up on.
     */
    classify(error: unknown): PollFailure {
        if (error instanceof ZaloError) return this.classifyZalo(error)
        if (error instanceof ChannelsError) {
            if (error.code === ChannelsErrorCode.ZaloRefreshBusy) return { kind: "transient" }
            const needsOwner = [ChannelsErrorCode.ZaloNotAuthorized, ChannelsErrorCode.SecretUnreadable].includes(
                error.code,
            )
            return needsOwner ? { kind: "auth_failed", reason: "credential" } : { kind: "fatal" }
        }
        return { kind: "fatal" }
    }

    private classifyZalo(error: ZaloError): PollFailure {
        if (error.params.zaloCode === PLAN_LACKS_FEATURE) {
            return { kind: "unavailable", reason: "plan", notice: ZALO_PLAN_LACKS_READING_NOTICE }
        }
        if (error.code === ZaloErrorCode.TokenRejected) return { kind: "auth_failed", reason: "credential" }
        if (error.code === ZaloErrorCode.NotPermitted || MISSING_PERMISSION.test(String(error.params.reason ?? ""))) {
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
