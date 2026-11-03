import type { ConnectionRecord } from "@modules/domain/connections"
import { eachInOrder } from "@modules/platform/primitives"
import { ConnectionPollLogEvent } from "./connection-poll.log-events"
import type {
    ConnectionPollDeps,
    ConnectionPoller,
    PollPage,
    PollSkipReason,
    PollSummary,
} from "./connection-poll.contracts"
import {
    POLL_MAX_PAGES,
    POLL_PAGE_SIZE,
    POLL_PAUSE_MS,
    cursorOf,
    laterOf,
    metaWithCursor,
    olderPageEnd,
    windowStartOf,
} from "./connection-poll.policy"

/** What one connection's walk over its pages read and found. */
interface Walk {
    /** The newest instant read so far. */
    readonly newest: Date | undefined
    /** Items stored that the webhook had not delivered. */
    readonly recorded: number
    /** Rows read. */
    readonly fetched: number
    /** Why the connection was left out, when it was. */
    readonly skipped: PollSkipReason | undefined
}

/** A summary with nothing counted yet. */
export const emptyPollSummary = (): PollSummary => ({ connections: 0, fetched: 0, recorded: 0, skipped: 0, failed: 0 })

/**
 * The generic poll of one connection, for any provider that plugs in a `ConnectionPoller`: it reads the provider's list since the last
 * instant it saw (the first run reads a bounded window back), page by page from the newest, stores each item through the poller (the
 * same inbox path and key the webhook uses, so an item the webhook delivered is a no-op), warns for every item the webhook had missed,
 * and moves the cursor only when the whole walk succeeded. A failure is logged and counted, never thrown, so the next connection runs.
 */
export class ConnectionPollRun {
    constructor(private readonly deps: ConnectionPollDeps) {}

    /** Polls one connection with its provider's poller and adds what it did to the summary. */
    async poll<Item>(poller: ConnectionPoller<Item>, record: ConnectionRecord, summary: PollSummary): Promise<void> {
        summary.connections += 1
        try {
            await this.pollWith(poller, record, summary)
        } catch (cause) {
            summary.failed += 1
            this.deps.logger.error(ConnectionPollLogEvent.Failed, cause, {
                connectionId: record.id,
                provider: record.provider,
            })
        }
    }

    private async pollWith<Item>(
        poller: ConnectionPoller<Item>,
        record: ConnectionRecord,
        summary: PollSummary,
    ): Promise<void> {
        if (record.environment === "test") return this.skip(record, "test_environment", summary)
        const cursor = cursorOf(record.meta)
        const from = windowStartOf(cursor, this.deps.clock.now())
        const start: Walk = { newest: cursor, recorded: 0, fetched: 0, skipped: undefined }
        const walk = await this.walk(poller, record, from, undefined, 0, start)
        summary.fetched += walk.fetched
        if (walk.skipped !== undefined) return this.skip(record, walk.skipped, summary)
        summary.recorded += walk.recorded
        if (walk.recorded > 0) {
            this.deps.logger.warn(ConnectionPollLogEvent.MissedByWebhook, {
                connectionId: record.id,
                provider: record.provider,
                missed: walk.recorded,
            })
        }
        if (walk.newest !== undefined && walk.newest.getTime() !== cursor?.getTime()) {
            await this.saveCursor(record, walk.newest)
        }
    }

    /** Reads the pages from the newest back, storing what each holds; stops at a page that is not full. */
    private async walk<Item>(
        poller: ConnectionPoller<Item>,
        record: ConnectionRecord,
        from: Date,
        to: Date | undefined,
        pageIndex: number,
        before: Walk,
    ): Promise<Walk> {
        if (pageIndex >= POLL_MAX_PAGES) return before
        if (pageIndex > 0) await this.pause()
        const page = await poller.fetch(record, { from, to, limit: POLL_PAGE_SIZE })
        if (page.kind === "skipped") return { ...before, skipped: page.reason }
        const stored = await this.store(poller, record, page)
        const after: Walk = {
            ...before,
            newest: laterOf(before.newest, page.newestAt),
            recorded: before.recorded + stored,
            fetched: before.fetched + page.fetched,
        }
        const older = olderPageEnd(page, POLL_PAGE_SIZE, to)
        return older === undefined ? after : this.walk(poller, record, from, older, pageIndex + 1, after)
    }

    /** Stores the items of a page one at a time; answers how many the webhook had not delivered. */
    private async store<Item>(
        poller: ConnectionPoller<Item>,
        record: ConnectionRecord,
        page: Extract<PollPage<Item>, { kind: "page" }>,
    ): Promise<number> {
        const outcomes: Array<boolean> = []
        await eachInOrder(page.items, async (item) => {
            outcomes.push(await poller.store(record, item))
        })
        return outcomes.filter(Boolean).length
    }

    private async saveCursor(record: ConnectionRecord, seenAt: Date): Promise<void> {
        const { connections } = this.deps
        const fresh = await connections.get(record.workspaceId, record.id)
        await connections.patch(record.workspaceId, record.id, { meta: metaWithCursor(fresh.meta, seenAt) })
    }

    private skip(record: ConnectionRecord, reason: PollSkipReason, summary: PollSummary): void {
        summary.skipped += 1
        this.deps.logger.info(ConnectionPollLogEvent.Skipped, {
            connectionId: record.id,
            provider: record.provider,
            reason,
        })
    }

    private pause(): Promise<void> {
        return new Promise((resolve) => {
            this.deps.timer.schedule(resolve, POLL_PAUSE_MS)
        })
    }
}
