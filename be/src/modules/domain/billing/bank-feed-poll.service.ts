import { Injectable } from "@nestjs/common"
import { ConnectionPollLogEvent, ConnectionPollRun, emptyPollSummary } from "@modules/domain/connection-poll"
import type { ConnectionPoller, PollSummary } from "@modules/domain/connection-poll"
import { ConnectionsService } from "@modules/domain/connections"
import type { ConnectionRecord, HealthCandidate } from "@modules/domain/connections"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import type { BankFeedPollPayload } from "@modules/queues/bank-feed-poll"
import type { PolledCredit } from "./bank-feed-poll.contracts"
import { SepayFeedPoller } from "./sepay-feed-poller.service"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

@Injectable()
/**
 * Catches the bank transactions a webhook never delivered: runs the generic connection poll over every bank connection whose provider has a
 * poller. One connection's failure never stops the run; calls are sequential with a pause between them.
 */
export class BankFeedPollService {
    private readonly pollers: ReadonlyArray<ConnectionPoller<PolledCredit>>
    private readonly run: ConnectionPollRun

    constructor(
        @InjectClock() clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() timer: Timer,
        private readonly connections: ConnectionsService,
        sepay: SepayFeedPoller,
    ) {
        this.pollers = [sepay]
        this.run = new ConnectionPollRun({ clock, logger, timer, connections })
    }

    /** Runs the reconcile a queued job asks for: one connection when the payload names it, else every connection of a polled provider. */
    reconcileFromJob(payload: BankFeedPollPayload): Promise<PollSummary> {
        return payload.connectionId === undefined || payload.workspaceId === undefined
            ? this.reconcileAll()
            : this.reconcileOne(payload.workspaceId, payload.connectionId)
    }

    /** Polls every connection of a polled provider; answers what the run did. */
    async reconcileAll(): Promise<PollSummary> {
        const summary = emptyPollSummary()
        await this.scan("", summary)
        this.logger.info(ConnectionPollLogEvent.Done, { ...summary })
        return summary
    }

    /** Polls one connection of a workspace, for example right after it became ready; a connection that is gone polls nothing. */
    async reconcileOne(workspaceId: string, connectionId: string): Promise<PollSummary> {
        const summary = emptyPollSummary()
        const record = await this.connections.find(workspaceId, connectionId)
        if (record !== null && record.status !== "disconnected") await this.pollRecord(record, summary)
        this.logger.info(ConnectionPollLogEvent.Done, { ...summary })
        return summary
    }

    private async scan(afterId: string, summary: PollSummary): Promise<void> {
        const batch = await this.connections.healthBatch(afterId, SCAN_PAGE)
        const last = batch.at(-1)
        if (last === undefined) return
        const polled = batch.filter((candidate) => this.pollerOf(candidate.provider) !== undefined)
        await eachInOrder(polled, (candidate) => this.pollCandidate(candidate, summary))
        if (batch.length === SCAN_PAGE) await this.scan(last.id, summary)
    }

    private async pollCandidate(candidate: HealthCandidate, summary: PollSummary): Promise<void> {
        const record = await this.connections.find(candidate.workspaceId, candidate.id)
        if (record !== null) await this.pollRecord(record, summary)
    }

    private async pollRecord(record: ConnectionRecord, summary: PollSummary): Promise<void> {
        const poller = this.pollerOf(record.provider)
        if (poller !== undefined) await this.run.poll(poller, record, summary)
    }

    private pollerOf(provider: string): ConnectionPoller<PolledCredit> | undefined {
        return this.pollers.find((poller) => poller.provider === provider)
    }
}
