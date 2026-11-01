import { Injectable } from "@nestjs/common"
import type { AgentRunWaitTimeout, WaitExpiry } from "@modules/domain/agent-runs"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { AgentGraphAsksService } from "./agent-graph-asks.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"

/** How long a wait lasts again when the branch's timeout asked a backup group, milliseconds. */
const RENEW_MS = 24 * 60 * 60_000

const ENDED: WaitExpiry = { kind: "ended" }

@Injectable()
/**
 * The graph's timeout for a wait step of a run: the same road an expired approval request takes (a backup group, a stop, or silence), applied
 * to the work item the step waits on. It writes no timeout of its own; it only calls the ask road and reports whether a new wait began.
 */
export class AgentGraphWaitTimeoutService implements AgentRunWaitTimeout {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly decisions: AgentGraphDecisionsService,
        private readonly asks: AgentGraphAsksService,
    ) {}

    /** Applies the branch's timeout to the item: renewed when a backup group was asked, ended otherwise. */
    async expire(workItemId: string): Promise<WaitExpiry> {
        const decision = await this.decisions.byItem(workItemId)
        if (decision === null || decision.closed || decision.approvalRequestId === null) return ENDED
        await this.asks.ended({ requestId: decision.approvalRequestId, outcome: "expired" })
        const after = await this.decisions.byItem(workItemId)
        if (after === null || after.closed) return ENDED
        return { kind: "renewed", deadlineAt: new Date(this.clock.now().getTime() + RENEW_MS) }
    }
}

