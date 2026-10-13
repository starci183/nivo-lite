import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AUTOMATION_COMMAND_JOB, AUTOMATION_QUEUE } from "@modules/queues/automation"
import { RunCommandStep } from "../../steps/run-command.step"

@Injectable()
/** The processor of the commands a manager queues from the screen: the runner claims and settles it, the one step runs the command. */
export class RunAutomationCommandProcessor extends FencedProcessor {
    readonly queue = AUTOMATION_QUEUE
    override readonly job = AUTOMATION_COMMAND_JOB

    constructor(private readonly step: RunCommandStep) {
        super()
    }

    /** Runs the one step; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }
}
