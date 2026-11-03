import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ZaloCredentialsService } from "@modules/domain/channels"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectZalo } from "@modules/integrations/zalo"
import type { ZaloChatMessage, ZaloClient } from "@modules/integrations/zalo"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ZaloInboxPollQueue } from "@modules/queues/zalo-inbox-poll"
import type { ZaloInboxPollPayload } from "@modules/queues/zalo-inbox-poll"
import { InjectZaloInboxOptions } from "./zalo-inbox.decorators"
import type { ZaloPollSkipReason, ZaloPollSummary } from "./zalo-inbox.contracts"
import { ZaloInboxLogEvent } from "./zalo-inbox.log-events"
import type { ZaloInboxOptions } from "./zalo-inbox.options"
import { ZaloInboxService } from "./zalo-inbox.service"
import {
    ZALO_POLL_MAX_PAGES,
    ZALO_POLL_PAGE_SIZE,
    ZALO_POLL_PAUSE_MS,
    cursorOf,
    isStaleMessage,
    metaWithCursor,
    pollRulesOf,
    windowStartOf,
} from "./zalo-poll.policy"
import type { ZaloPollRules } from "./zalo-poll.policy"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

/** The provider key of a Zalo OA connection. */
const ZALO_PROVIDER = "zalo_oa"

/** Reads one page of a chat list from an offset. */
type ChatReader = (offset: number) => Promise<ReadonlyArray<ZaloChatMessage>>

/** What a connection's customers wrote since the window start. */
interface Heard {
    /** The text messages, oldest first. */
    readonly texts: ReadonlyArray<ZaloChatMessage>
    /** The instant of the newest customer message of any kind; undefined when there was none. */
    readonly newest: number | undefined
}

/** How many messages a store was new to the inbox, and how many of those were stale. */
interface Stored {
    readonly recorded: number
    readonly expired: number
}

const emptySummary = (): ZaloPollSummary => ({
    connections: 0,
    fetched: 0,
    recorded: 0,
    expired: 0,
    skipped: 0,
    failed: 0,
})

@Injectable()
/**
 * Catches the Zalo messages a webhook never delivered (it was not yet connected, or the call was lost). Per connection that holds an access token it
 * reads the OA's recent chats and then each active conversation, newest first, down to the instant the last run saw (the first run reads the backfill
 * window back), keeps the text the customer wrote, and stores each message through the inbox under the webhook's delivery id, so a message both doors
 * bring is one row. A message past the reply window or the stale age is kept for the owner and no agent answers it. One connection's failure never
 * stops the run; calls are sequential with a pause between them.
 */
export class ZaloInboxPollService {
    private readonly rules: ZaloPollRules

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
        @InjectZalo() private readonly zalo: ZaloClient,
        @InjectZaloInboxOptions() options: ZaloInboxOptions,
        private readonly connections: ConnectionsService,
        private readonly credentials: ZaloCredentialsService,
        private readonly inbox: ZaloInboxService,
        private readonly queue: ZaloInboxPollQueue,
    ) {
        this.rules = pollRulesOf(options)
    }

    /** Asks for the reconcile of one connection that just became ready (the owner authorised it): the job reads its backfill window back without making the caller wait. */
    requestReconcile(workspaceId: string, connectionId: string): Promise<void> {
        return this.entityManager.transaction((manager) =>
            this.queue.enqueueReconcile({ workspaceId, connectionId }, this.clock.now(), manager),
        )
    }

    /** Runs the reconcile a queued job asks for: one connection when the payload names it, else every Zalo connection. */
    reconcileFromJob(payload: ZaloInboxPollPayload): Promise<ZaloPollSummary> {
        return payload.connectionId === undefined || payload.workspaceId === undefined
            ? this.reconcileAll()
            : this.reconcileOne(payload.workspaceId, payload.connectionId)
    }

    /** Reads back every Zalo connection; answers what the run did. */
    async reconcileAll(): Promise<ZaloPollSummary> {
        const summary = emptySummary()
        await this.scan("", summary)
        this.logger.info(ZaloInboxLogEvent.PollDone, { ...summary })
        return summary
    }

    /** Reads back one connection of a workspace, for example right after the owner authorised it; a connection that is gone reads nothing. */
    async reconcileOne(workspaceId: string, connectionId: string): Promise<ZaloPollSummary> {
        const summary = emptySummary()
        const record = await this.connections.find(workspaceId, connectionId)
        if (record !== null && record.status !== "disconnected") await this.pollRecord(record, summary)
        this.logger.info(ZaloInboxLogEvent.PollDone, { ...summary })
        return summary
    }

    private async scan(afterId: string, summary: ZaloPollSummary): Promise<void> {
        const batch = await this.connections.healthBatch(afterId, SCAN_PAGE)
        const last = batch.at(-1)
        if (last === undefined) return
        const zalo = batch.filter((candidate) => candidate.provider === ZALO_PROVIDER)
        await eachInOrder(zalo, async (candidate) => {
            const record = await this.connections.find(candidate.workspaceId, candidate.id)
            if (record !== null) await this.pollRecord(record, summary)
        })
        if (batch.length === SCAN_PAGE) await this.scan(last.id, summary)
    }

    /** Reads one connection; a failure is logged and counted, never thrown, so the next connection still runs. */
    private async pollRecord(record: ConnectionRecord, summary: ZaloPollSummary): Promise<void> {
        try {
            await this.pollConnection(record, summary)
        } catch (cause) {
            summary.failed += 1
            this.logger.error(ZaloInboxLogEvent.PollFailed, cause, { connectionId: record.id })
        }
    }

    private async pollConnection(record: ConnectionRecord, summary: ZaloPollSummary): Promise<void> {
        const skipped = await this.skipReasonOf(record.id)
        if (skipped !== undefined) {
            summary.skipped += 1
            this.logger.info(ZaloInboxLogEvent.PollSkipped, { connectionId: record.id, reason: skipped })
            return
        }
        summary.connections += 1
        const accessToken = await this.credentials.accessToken(record.id)
        const cursor = cursorOf(record.meta)
        const heard = await this.heardFrom(accessToken, windowStartOf(cursor, this.clock.now().getTime(), this.rules))
        summary.fetched += heard.texts.length
        const stored = await this.store(record, heard.texts)
        summary.recorded += stored.recorded
        summary.expired += stored.expired
        if (stored.recorded > 0) {
            this.logger.warn(ZaloInboxLogEvent.PollMissedByWebhook, { connectionId: record.id, missed: stored.recorded })
        }
        if (heard.newest !== undefined && heard.newest !== cursor) await this.saveCursor(record, heard.newest)
    }

    private async skipReasonOf(connectionId: string): Promise<ZaloPollSkipReason | undefined> {
        const loaded = await this.credentials.load(connectionId)
        if (loaded.kind !== "ok") return "no_credential"
        return loaded.value.secret.accessToken === undefined ? "no_token" : undefined
    }

    /** What the customers wrote since `from`: the recent chats name the conversations that moved, then each one is read. */
    private async heardFrom(accessToken: string, from: number): Promise<Heard> {
        const recent = await this.readBack((offset) => this.zalo.recentChats(accessToken, offset), from)
        const users = [...new Set(recent.map((chat) => chat.userId))]
        const written: Array<ZaloChatMessage> = []
        await eachInOrder(users, async (userId) => {
            await this.pause()
            const chat = await this.readBack((offset) => this.zalo.conversation(accessToken, userId, offset), from)
            written.push(...chat.filter((message) => message.fromUser))
        })
        const newest = written.reduce<number | undefined>((latest, message) => Math.max(latest ?? 0, message.sentAt), undefined)
        const texts = written
            .filter((message) => message.kind === "text" && message.text.trim() !== "")
            .sort((a, b) => a.sentAt - b.sentAt)
        return { texts, newest }
    }

    /** Pages one chat list from the newest back while its rows are still inside the window; stops at a short page or the page limit. */
    private async readBack(
        read: ChatReader,
        from: number,
        offset = 0,
        collected: ReadonlyArray<ZaloChatMessage> = [],
    ): Promise<ReadonlyArray<ZaloChatMessage>> {
        if (offset >= ZALO_POLL_MAX_PAGES * ZALO_POLL_PAGE_SIZE) return collected
        if (offset > 0) await this.pause()
        const rows = await read(offset)
        const all = [...collected, ...rows.filter((row) => row.sentAt >= from)]
        const oldest = rows.at(-1)
        const reachedBack = rows.length < ZALO_POLL_PAGE_SIZE || (oldest !== undefined && oldest.sentAt < from)
        return reachedBack ? all : this.readBack(read, from, offset + ZALO_POLL_PAGE_SIZE, all)
    }

    /** Stores the messages one at a time through the inbox. */
    private async store(record: ConnectionRecord, texts: ReadonlyArray<ZaloChatMessage>): Promise<Stored> {
        const now = this.clock.now().getTime()
        const tally = { recorded: 0, expired: 0 }
        await eachInOrder(texts, async (message) => {
            const stale = isStaleMessage(message.sentAt, now, this.rules)
            const isNew = await this.inbox.acceptPolledMessage(
                record.id,
                { messageId: message.messageId, userId: message.userId, text: message.text, sentAt: message.sentAt },
                { workspaceId: record.workspaceId, sender: message.userName || message.userId, stale },
            )
            if (!isNew) return
            tally.recorded += 1
            if (stale) tally.expired += 1
        })
        return tally
    }

    private async saveCursor(record: ConnectionRecord, seenAt: number): Promise<void> {
        const fresh = await this.connections.get(record.workspaceId, record.id)
        await this.connections.patch(record.workspaceId, record.id, { meta: metaWithCursor(fresh.meta, seenAt) })
    }

    private pause(): Promise<void> {
        return new Promise((resolve) => {
            this.timer.schedule(resolve, ZALO_POLL_PAUSE_MS)
        })
    }
}
