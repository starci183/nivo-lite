import { Injectable } from "@nestjs/common"
import type { FlowAlerts, ParkedFlowAlert } from "@modules/platform/jobs"

@Injectable()
/**
 * Where a parked run tells its owner: the capability that files the owner's items registers its alerts when its module starts
 * (`onModuleInit`), the way a step handler registers. The run engine therefore never holds the capability in its constructor: that
 * capability reaches the run engine itself (an item that closes resumes a wait), so a constructor dependency would be a provider cycle
 * that hangs the boot without a report. With nothing registered (an app that files no items) an alert raises nothing.
 */
export class AgentRunAlertsService implements FlowAlerts {
    private readonly alerts: Array<FlowAlerts> = []

    /** Registers the alerts of a capability; each one is told every parked run. */
    add(alerts: FlowAlerts): void {
        this.alerts.push(alerts)
    }

    /** Tells every registered alert, one after the other; the first that throws stops the rest, so the caller tries the run again. */
    async raise(alert: ParkedFlowAlert): Promise<void> {
        await this.alerts.reduce<Promise<void>>((told, each) => told.then(() => each.raise(alert)), Promise.resolve())
    }
}
