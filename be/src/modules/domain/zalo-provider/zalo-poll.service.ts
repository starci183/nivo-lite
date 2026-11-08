import { Injectable } from "@nestjs/common"
import {
    ConnectionPollLogEvent,
    ConnectionPollRunService,
    emptyPollSummary,
    type PollSummary,
} from "@modules/domain/connection-poll"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { ConnectionsService, type HealthCandidate } from "@modules/domain/connections"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer, type Timer } from "@modules/platform/retry"
import { isZaloInboxPollPayload } from "@modules/queues/zalo-inbox-poll"
import { ZaloInboxPollerService } from "./zalo-inbox-poller.service"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

@Injectable()
/**
 * Catches the Zalo messages a webhook never delivered (it was not yet connected, or the call was lost): runs the generic connection poll over every
 * Zalo connection. One connection's failure never stops the run; calls are sequential with a pause between them.
 */
export class ZaloInboxPollService {
    private readonly run: ConnectionPollRunService

    constructor(
        @InjectClock() clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() timer: Timer,
        private readonly connections: ConnectionsService,
        private readonly poller: ZaloInboxPollerService,
    ) {
        this.run = new ConnectionPollRunService({ clock, logger, timer, connections })
    }

    /** True when connections of the provider can be read back. */
    polls(provider: string): boolean {
        return provider === this.poller.provider
    }

    /** Runs the reconcile a queued job asks for: one connection when the payload names it, else every Zalo connection. A payload that is not a poll payload polls nothing. */
    reconcileFromJob(payload: unknown): Promise<PollSummary> {
        if (!isZaloInboxPollPayload(payload)) return Promise.resolve(emptyPollSummary())
        return payload.connectionId === undefined || payload.workspaceId === undefined
            ? this.reconcileAll()
            : this.reconcileOne(payload.workspaceId, payload.connectionId)
    }

    /** Polls every Zalo connection; answers what the run did. */
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
        if (record !== null && record.status !== "disconnected") await this.run.poll(this.poller, record, summary)
        this.logger.info(ConnectionPollLogEvent.Done, { ...summary })
        return summary
    }

    private async scan(afterId: string, summary: PollSummary): Promise<void> {
        const batch = await this.connections.healthBatch(afterId, SCAN_PAGE)
        const last = batch.at(-1)
        if (last === undefined) return
        const zalo = batch.filter((candidate) => candidate.provider === this.poller.provider)
        await eachInOrder(zalo, (candidate) => this.pollCandidate(candidate, summary))
        if (batch.length === SCAN_PAGE) await this.scan(last.id, summary)
    }

    private async pollCandidate(candidate: HealthCandidate, summary: PollSummary): Promise<void> {
        const record = await this.connections.find(candidate.workspaceId, candidate.id)
        if (record !== null) await this.run.poll(this.poller, record, summary)
    }
}
