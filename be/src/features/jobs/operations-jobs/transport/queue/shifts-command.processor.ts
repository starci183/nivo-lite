import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { SHIFTS_COMMAND_QUEUE } from "@modules/queues/shifts-command"
import { RunShiftsCommandStep } from "../../steps/run-shifts-command.step"

@Injectable()
/** The processor of the shifts-command job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ShiftsCommandProcessor extends FencedProcessor {
    readonly queue = SHIFTS_COMMAND_QUEUE

    constructor(private readonly runCommand: RunShiftsCommandStep) {
        super()
    }

    /** Runs the command; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.runCommand.run(job)
    }
}
