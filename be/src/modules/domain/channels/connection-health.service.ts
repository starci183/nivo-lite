import { Injectable } from "@nestjs/common"
import { ConnectionsService } from "@modules/domain/connections"
import type { HealthCandidate } from "@modules/domain/connections"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type { HealthSummary, HealthTally } from "./channels.contracts"
import { ChannelsLogEvent } from "./channels.log-events"
import { judgeConnection } from "./connection-health.policy"

/** How many connections one page of the check reads. */
const PAGE = 200
/** A receiving connection with no event for this long is silent unless the job says otherwise. */
const DEFAULT_SILENT_AFTER_HOURS = 72

@Injectable()
/**
 * Marks the connections that are failing (status error) or silent for too long. The mark lives in the public facts of the connection and is written only
 * when the state changes; it never changes a status, which stays the owner decision.
 */
export class ConnectionHealthService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly connections: ConnectionsService,
    ) {}

    /** Judges every connection that is set up and records the verdicts that changed; answers how many it saw in each state. */
    async checkAll(silentAfterHours: number = DEFAULT_SILENT_AFTER_HOURS): Promise<HealthSummary> {
        const tally: HealthTally = { checked: 0, ok: 0, silent: 0, failing: 0, changed: 0 }
        await this.page("", silentAfterHours, tally)
        return { ...tally }
    }

    private async page(afterId: string, silentAfterHours: number, tally: HealthTally): Promise<void> {
        const batch = await this.connections.healthBatch(afterId, PAGE)
        const last = batch.at(-1)
        if (last === undefined) return
        await eachInOrder(batch, (connection) => this.judge(connection, silentAfterHours, tally))
        if (batch.length === PAGE) await this.page(last.id, silentAfterHours, tally)
    }

    private async judge(connection: HealthCandidate, silentAfterHours: number, counts: HealthTally): Promise<void> {
        // Setup is not finished: nothing to judge yet.
        if (connection.status === "pending") return
        counts.checked += 1
        const verdict = judgeConnection(connection, this.clock.now().getTime(), silentAfterHours)
        counts[verdict.state] += 1
        if (connection.health === verdict.state || (verdict.state === "ok" && connection.health === "")) return
        await this.connections.markHealth(connection.id, { ...verdict, checkedAt: this.clock.now().toISOString() })
        counts.changed += 1
        if (verdict.state !== "ok") {
            this.logger.warn(ChannelsLogEvent.ConnectionUnhealthy, {
                workspaceId: connection.workspaceId,
                connectionId: connection.id,
                provider: connection.provider,
                state: verdict.state,
            })
        }
    }
}
