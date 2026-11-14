import { Injectable } from "@nestjs/common"
import {
    ConnectionPollLogEvent,
    ConnectionPollRunService,
    emptyPollSummary,
    type ConnectionPoller,
    type PollSummary,
} from "@modules/domain/connection-poll"
import { ConnectionsService, type ConnectionRecord, type HealthCandidate } from "@modules/domain/connections"
import {
    BankFeedPollerRegistryService,
    type BankFeedPoller,
    type PolledCredit,
} from "@modules/domain/provider-registry"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer, type Timer } from "@modules/platform/retry"
import { isBankFeedPollPayload } from "@modules/queues/bank-feed-poll"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

@Injectable()
/**
 * Catches the bank transactions a webhook never delivered: runs the generic connection poll over every bank connection whose provider has a
 * poller. One connection's failure never stops the run; calls are sequential with a pause between them.
 */
export class BankFeedPollService {
    private readonly run: ConnectionPollRunService

    constructor(
        @InjectClock() clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() timer: Timer,
        private readonly connections: ConnectionsService,
        private readonly pollers: BankFeedPollerRegistryService,
        private readonly feed: BankFeedReceiptsService,
    ) {
        this.run = new ConnectionPollRunService({ clock, logger, timer, connections })
    }

    /** True when connections of the provider can be read back. */
    polls(provider: string): boolean {
        return this.pollers.has(provider)
    }

    /**
     * Runs the reconcile a queued job asks for: one connection when the payload names it, else every connection of a polled provider.
     * A payload that is not a poll payload polls nothing.
     */
    reconcileFromJob(payload: unknown): Promise<PollSummary> {
        if (!isBankFeedPollPayload(payload)) return Promise.resolve(emptyPollSummary())
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
        const polled = batch.filter((candidate) => this.pollers.has(candidate.provider))
        await eachInOrder(polled, (candidate) => this.pollCandidate(candidate, summary))
        if (batch.length === SCAN_PAGE) await this.scan(last.id, summary)
    }

    private async pollCandidate(candidate: HealthCandidate, summary: PollSummary): Promise<void> {
        const record = await this.connections.find(candidate.workspaceId, candidate.id)
        if (record !== null) await this.pollRecord(record, summary)
    }

    private async pollRecord(record: ConnectionRecord, summary: PollSummary): Promise<void> {
        const poller = this.pollers.portFor(record)
        if (poller !== undefined) await this.run.poll(this.withStore(poller), record, summary)
    }

    /** The provider's reader with the one store every bank provider shares: the feed receipt its webhook feeds, under the webhook's key. */
    private withStore(poller: BankFeedPoller): ConnectionPoller<PolledCredit> {
        return {
            provider: poller.provider,
            fetch: (connection, window) => poller.fetch(connection, window),
            store: (connection, item) =>
                this.feed.acceptPolledCredit(connection.id, poller.inboxProvider, item.deliveryId, item.credit),
        }
    }
}
