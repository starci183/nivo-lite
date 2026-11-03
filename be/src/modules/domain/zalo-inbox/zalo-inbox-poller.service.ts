import { Injectable } from "@nestjs/common"
import { ZaloCredentialsService } from "@modules/domain/channels"
import type { ConnectionPoller, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloChatMessage, ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { InjectZaloInboxOptions } from "./zalo-inbox.decorators"
import type { ZaloInboxOptions } from "./zalo-inbox.options"
import { ZaloInboxService } from "./zalo-inbox.service"
import {
    ZALO_POLL_MAX_PAGES,
    ZALO_POLL_PAGE_SIZE,
    ZALO_POLL_PAUSE_MS,
    isStaleMessage,
    pollRulesOf,
} from "./zalo-poll.policy"
import type { ZaloPollRules } from "./zalo-poll.policy"

/** Reads one page of a chat list from an offset. */
type ChatReader = (offset: number) => Promise<ReadonlyArray<ZaloChatMessage>>

@Injectable()
/**
 * Reads the customer messages of a Zalo OA connection with its access token: the recent chats name the conversations that moved inside the window,
 * then each conversation is read newest first. Answers what the customers wrote as one page (Zalo lists ten rows per call, so the walk over the
 * calls is bounded here), and stores each text message through the inbox under the delivery id of the webhook.
 */
export class ZaloInboxPoller implements ConnectionPoller<ZaloChatMessage> {
    readonly provider = "zalo_oa"
    private readonly rules: ZaloPollRules

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectTimer() private readonly timer: Timer,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectZaloInboxOptions() options: ZaloInboxOptions,
        private readonly credentials: ZaloCredentialsService,
        private readonly inbox: ZaloInboxService,
    ) {
        this.rules = pollRulesOf(options)
    }

    /** Reads the window; a connection without a usable credential or an access token is left out, not failed. */
    async fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<ZaloChatMessage>> {
        const loaded = await this.credentials.load(connection.id)
        if (loaded.kind !== "ok") return { kind: "skipped", reason: "not_ready" }
        if (loaded.value.secret.accessToken === undefined) return { kind: "skipped", reason: "no_token" }
        const accessToken = await this.credentials.accessToken(connection.id)
        const written = await this.writtenIn(accessToken, window)
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

    /** What the customers wrote inside the window, of any kind, from the conversations that moved. */
    private async writtenIn(accessToken: string, window: PollWindow): Promise<ReadonlyArray<ZaloChatMessage>> {
        const recent = await this.readBack((offset) => this.zalo.recentChats(accessToken, offset), window)
        const users = [...new Set(recent.map((chat) => chat.userId))]
        const written: Array<ZaloChatMessage> = []
        await eachInOrder(users, async (userId) => {
            await this.pause()
            const chat = await this.readBack((offset) => this.zalo.conversation(accessToken, userId, offset), window)
            written.push(...chat.filter((message) => message.fromUser))
        })
        return written
    }

    /** Pages one chat list from the newest back while its rows reach the window; stops at a short page or the page limit. */
    private async readBack(
        read: ChatReader,
        window: PollWindow,
        offset = 0,
        collected: ReadonlyArray<ZaloChatMessage> = [],
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        if (offset >= ZALO_POLL_MAX_PAGES * ZALO_POLL_PAGE_SIZE) return collected
        if (offset > 0) await this.pause()
        const rows = await read(offset)
        const from = window.from.getTime()
        const to = window.to?.getTime() ?? Number.POSITIVE_INFINITY
        const all = [...collected, ...rows.filter((row) => row.sentAt >= from && row.sentAt <= to)]
        const oldest = rows.at(-1)
        const reachedBack = rows.length < ZALO_POLL_PAGE_SIZE || (oldest !== undefined && oldest.sentAt < from)
        return reachedBack ? all : this.readBack(read, window, offset + ZALO_POLL_PAGE_SIZE, all)
    }

    private pause(): Promise<void> {
        return new Promise((resolve) => {
            this.timer.schedule(resolve, ZALO_POLL_PAUSE_MS)
        })
    }
}
