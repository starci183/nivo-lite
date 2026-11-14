import { Injectable } from "@nestjs/common"
import type { AgentProbe, ProbeAnswer } from "../agent-schedules.contracts"

/** The key the evening close of the books is fired under; the graph reads it as `trigger.context.probeKey`. */
export const ACCOUNTING_CLOSE_PROBE = "accounting_close"

@Injectable()
/**
 * The evening close of the books always has work: the daily report is owed every evening whether or not money came in (a quiet day is a
 * report too), and the last evening of the month adds the reconciliation. Nothing is looked at here; the graph reads the books itself.
 */
export class AccountingCloseProbeService implements AgentProbe {
    readonly key: typeof ACCOUNTING_CLOSE_PROBE = ACCOUNTING_CLOSE_PROBE

    /** Always answers that there is work. */
    check(): Promise<ProbeAnswer> {
        return Promise.resolve({ work: true, brief: "Close the books for the day.", subjectIds: [] })
    }
}
