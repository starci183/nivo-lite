import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ConnectionPollLogEvent, ConnectionPollRun, emptyPollSummary } from "@modules/domain/connection-poll"
import type { PollSummary } from "@modules/domain/connection-poll"
import { ConnectionsService } from "@modules/domain/connections"
import type { HealthCandidate } from "@modules/domain/connections"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { ZaloInboxPollQueue } from "@modules/queues/zalo-inbox-poll"
import type { ZaloInboxPollPayload } from "@modules/queues/zalo-inbox-poll"
import { ZaloInboxPoller } from "./zalo-inbox-poller.service"

/** How many connections one page of the connection scan reads. */
const SCAN_PAGE = 200

@Injectable()
/**
 * Catches the Zalo messages a webhook never delivered (it was not yet connected, or the call was lost): runs the generic connection poll over every
 * Zalo connection. One connection's failure never stops the run; calls are sequential with a pause between them.
 */
export class ZaloInboxPollService {
    private readonly run: ConnectionPollRun

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() timer: Timer,
        private readonly connections: ConnectionsService,
        private readonly poller: ZaloInboxPoller,
        private readonly queue: ZaloInboxPollQueue,
    ) {
        this.run = new ConnectionPollRun({ clock, logger, timer, connections })
    }

    /** Asks for the reconcile of one connection that just became ready (the owner authorised it): the job reads its backfill window back without making the caller wait. */
    requestReconcile(workspaceId: string, connectionId: string): Promise<void> {
        return this.entityManager.transaction((manager) =>
            this.queue.enqueueReconcile({ workspaceId, connectionId }, this.clock.now(), manager),
        )
    }

    /** Runs the reconcile a queued job asks for: one connection when the payload names it, else every Zalo connection. */
    reconcileFromJob(payload: ZaloInboxPollPayload): Promise<PollSummary> {
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
