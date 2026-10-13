import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { SHIFTS_QUEUE } from "@modules/queues/shifts"
import { RunShiftsAlertsStep } from "../../steps/run.step"

@Injectable()
/** The processor of every shift-alerts job (the minute tick, the reminders, the no-show checks): the one step runs it. */
export class RunShiftsAlertsProcessor extends FencedProcessor {
    readonly queue = SHIFTS_QUEUE

    constructor(private readonly step: RunShiftsAlertsStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
