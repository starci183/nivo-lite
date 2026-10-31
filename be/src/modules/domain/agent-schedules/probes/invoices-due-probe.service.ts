import { Injectable } from "@nestjs/common"
import { InvoicesLedgerService } from "@modules/domain/invoices"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { BRIEF_ITEMS } from "../agent-schedules.policy"
import type { AgentProbe, ProbeAgent, ProbeAnswer } from "../agent-schedules.contracts"
import { listOf } from "./probe-brief.policy"

@Injectable()
/** Looks at the workspace's issued invoices that fell due and are still unpaid. */
export class InvoicesDueProbeService implements AgentProbe {
    readonly key = "invoices_due"

    constructor(
        private readonly invoices: InvoicesLedgerService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Answers the oldest overdue invoices, or no work. */
    async check(agent: ProbeAgent): Promise<ProbeAnswer> {
        const overdue = await this.invoices.overdueBefore(agent.workspaceId, this.clock.now(), BRIEF_ITEMS + 1)
        if (overdue.length === 0) return { work: false }
        return {
            work: true,
            brief: `Invoices past due: ${listOf(overdue.map((invoice) => invoice.invoiceNo))}.`,
            subjectIds: overdue.slice(0, BRIEF_ITEMS).map((invoice) => invoice.id),
        }
    }
}
