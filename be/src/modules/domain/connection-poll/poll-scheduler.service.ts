import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord } from "@modules/domain/connections"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ConnectionPollRun, emptyPollSummary } from "./connection-poll-run.service"
import { InjectConnectionPollOptions, InjectPollRandom } from "./connection-poll.decorators"
import type { PollRandom } from "./connection-poll.decorators"
import { ConnectionPollLogEvent } from "./connection-poll.log-events"
import { cursorOf } from "./connection-poll.policy"
import { ConnectionPollError, ConnectionPollErrorCode } from "./errors/connection-poll.error"
import { PollLimiterService } from "./poll-limiter.service"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"
import { authReasonOf, interleavedByWorkspace, jittered, planAfterFailure, planAfterRead, probeOf } from "./poll-schedule.policy"
import type { PollFailure } from "./connection-poll.contracts"
import type { PollPlan } from "./poll-schedule.policy"
import { PollScheduleService } from "./poll-schedule.service"
import type { DueConnection } from "./poll-schedule.service"
import { PollSourceRegistry } from "./poll-source-registry.service"
import type {
    ConnectionPollOptions,
    PollOutcome,
    PollWalkOptions,
    ScheduledPollSource,
} from "./poll-schedule.contracts"

/** A busy provider is asked again after this long. */
const BUSY_RETRY_MS = 5_000

/** What one tick did for one provider; the numbers the metrics log carries. */
export interface ProviderTally {
    /** Connections polled. */
    polled: number
    /** Rows the provider listed. */
    found: number
    /** Items stored that the webhook had not delivered. */
    missedByWebhook: number
    /** Answers that asked to slow down (429). */
    rateLimited: number
    /** Answers that refused the credential. */
    authFailed: number
    /** Failures to retry later. */
    transient: number
    /** Polls the provider's plan does not allow. */
    unavailable: number
    /** Failures to give up on. */
    fatal: number
    /** Polls that waited for the rate limit and were planned again, or found the provider busy. */
    deferred: number
    /** How far past its planned time the latest poll started, in milliseconds. */
    maxLagMs: number
}

const emptyTally = (): ProviderTally => ({
    polled: 0,
    found: 0,
    missedByWebhook: 0,
    rateLimited: 0,
    authFailed: 0,
    transient: 0,
    unavailable: 0,
    fatal: 0,
    deferred: 0,
    maxLagMs: 0,
})

@Injectable()
/**
 * One tick of the adaptive poll: gives every connection a schedule row, claims only the connections that are due (a batch, fair across workspaces),
 * polls each under the provider's rate limit and concurrency cap, and plans its next poll from how it ended: the adaptive interval with jitter, the
 * backoff of a 429 or a transient failure, the breaker, or the owner request of a refused credential. Nothing here names a provider.
 */
export class PollSchedulerService {
    private readonly run: ConnectionPollRun

    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() timer: Timer,
        @InjectPollRandom() private readonly random: PollRandom,
        @InjectConnectionPollOptions() private readonly options: ConnectionPollOptions,
        private readonly connections: ConnectionsService,
        private readonly schedule: PollScheduleService,
        private readonly sources: PollSourceRegistry,
        private readonly limiter: PollLimiterService,
        private readonly notice: PollOwnerNoticeService,
    ) {
        this.run = new ConnectionPollRun({
            clock,
            logger,
            timer,
            connections,
            beforeFetch: (connection) => this.takeToken(connection),
        })
    }

    /** Polls what is due now; answers what it did for each provider. */
    async tick(): Promise<ReadonlyMap<string, ProviderTally>> {
        const tallies = new Map<string, ProviderTally>()
        const providers = this.sources.providers()
        if (providers.length === 0) return tallies
        await this.schedule.enroll(providers)
        const due = await this.schedule.claimDue(providers, this.options.schedule.batchSize)
        const ordered = interleavedByWorkspace(due.map((item) => ({ ...item, workspaceId: item.row.workspaceId })))
        await eachInOrder(ordered, (item) => this.pollOne(item, tallies))
        tallies.forEach((tally, provider) => {
            this.logger.info(ConnectionPollLogEvent.Metrics, { provider, ...tally })
        })
        return tallies
    }

    private async takeToken(connection: ConnectionRecord): Promise<void> {
        const source = this.sources.sourceOf(connection.provider)
        if (source !== undefined) await this.limiter.pass(connection.provider, connection.id, source.limits)
    }

    private async pollOne(item: DueConnection, tallies: Map<string, ProviderTally>): Promise<void> {
        const { row } = item
        const source = this.sources.sourceOf(row.provider)
        const record = await this.connections.find(row.workspaceId, row.connectionId)
        if (source === undefined || record === null || record.status === "disconnected") {
            await this.defer(row.connectionId, this.options.schedule.healthyIntervalMs)
            return
        }
        const slot = await this.limiter.enter(row.provider, row.connectionId, source.limits)
        const tally = tallies.get(row.provider) ?? emptyTally()
        tallies.set(row.provider, tally)
        if (slot === undefined) {
            tally.deferred += 1
            await this.defer(row.connectionId, BUSY_RETRY_MS)
            return
        }
        const now = this.clock.now().getTime()
        tally.polled += 1
        tally.maxLagMs = Math.max(tally.maxLagMs, now - item.dueAt.getTime())
        const outcome = await this.run
            .poll(source.poller, record, emptyPollSummary(), this.walkOf(item, record))
            .finally(() => slot.release())
        await this.settle(item, record, source, outcome, tally)
    }

    /** The first poll of a connection is a backfill read in chunks, so it goes through the same limiter as every other poll and never in one burst. */
    private walkOf(item: DueConnection, record: ConnectionRecord): PollWalkOptions {
        const { backfillTo, backfillNewest } = item.row
        const maxPages = this.options.schedule.backfillChunkPages
        if (backfillTo !== null) {
            return { to: backfillTo, newest: backfillNewest ?? undefined, maxPages }
        }
        return cursorOf(record.meta) === undefined ? { maxPages } : {}
    }

    private async settle(
        item: DueConnection,
        record: ConnectionRecord,
        source: ScheduledPollSource,
        outcome: PollOutcome,
        tally: ProviderTally,
    ): Promise<void> {
        const now = this.clock.now().getTime()
        const unit = this.random()
        const row = probeOf(item.row)
        if (outcome.kind !== "failed") {
            tally.found += outcome.kind === "skipped" ? 0 : outcome.fetched
            tally.missedByWebhook += outcome.kind === "skipped" ? 0 : outcome.recorded
            await this.schedule.settle(row.connectionId, planAfterRead(row, outcome, now, this.options.schedule, unit))
            return
        }
        if (outcome.cause instanceof ConnectionPollError && outcome.cause.code === ConnectionPollErrorCode.Deferred) {
            tally.deferred += 1
            const waitMs: unknown = outcome.cause.params.waitMs
            this.logger.info(ConnectionPollLogEvent.Deferred, { connectionId: row.connectionId, provider: row.provider })
            await this.defer(row.connectionId, typeof waitMs === "number" ? waitMs : BUSY_RETRY_MS)
            return
        }
        const failure = source.classify(outcome.cause)
        tally.rateLimited += failure.kind === "rate_limited" ? 1 : 0
        tally.authFailed += failure.kind === "auth_failed" ? 1 : 0
        tally.transient += failure.kind === "transient" ? 1 : 0
        tally.unavailable += failure.kind === "unavailable" ? 1 : 0
        tally.fatal += failure.kind === "fatal" ? 1 : 0
        const plan = planAfterFailure(row, failure, now, this.options.schedule, unit)
        await this.schedule.settle(row.connectionId, plan)
        await this.report(record, failure, plan, now)
    }

    private async report(record: ConnectionRecord, failure: PollFailure, plan: PollPlan, now: number): Promise<void> {
        if (plan.breakerState === "open") {
            this.logger.warn(ConnectionPollLogEvent.BreakerOpened, { connectionId: record.id, provider: record.provider, kind: failure.kind })
        }
        if (!plan.raiseOwnerNotice) return
        if (failure.kind === "unavailable") {
            this.logger.warn(ConnectionPollLogEvent.Unavailable, {
                connectionId: record.id,
                provider: record.provider,
                reason: failure.reason,
            })
            await this.notice.unavailable(record, failure.notice, now)
            return
        }
        this.logger.warn(ConnectionPollLogEvent.NeedsReauth, { connectionId: record.id, provider: record.provider })
        await this.notice.needsReauth(record, now, authReasonOf(failure))
    }

    private defer(connectionId: string, afterMs: number): Promise<void> {
        const at = this.clock.now().getTime() + jittered(afterMs, this.options.schedule.jitterRatio, this.random())
        return this.schedule.defer(connectionId, new Date(at))
    }
}
