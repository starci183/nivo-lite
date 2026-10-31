import { Injectable } from "@nestjs/common"
import { InvoicesCashReadService } from "@modules/domain/invoices"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { PROBE_WINDOW_MS } from "../agent-schedules.policy"
import type { AgentProbe, ProbeAgent, ProbeAnswer } from "../agent-schedules.contracts"

@Injectable()
/** Looks at the money the workspace's invoices took in during the last day. */
export class MoneyInProbeService implements AgentProbe {
    readonly key = "money_in"

    constructor(
        private readonly cash: InvoicesCashReadService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Answers the total paid in the window, or no work when nothing was. */
    async check(agent: ProbeAgent): Promise<ProbeAnswer> {
        const total = await this.cash.paidTotalSince(
            agent.workspaceId,
            new Date(this.clock.now().getTime() - PROBE_WINDOW_MS),
        )
        if (total <= 0) return { work: false }
        return { work: true, brief: `Invoices paid in the last 24 hours add up to ${String(total)} VND.`, subjectIds: [] }
    }
}
