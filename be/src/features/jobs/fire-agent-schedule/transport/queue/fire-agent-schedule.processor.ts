import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { AGENT_SCHEDULE_FIRE_JOB, AGENT_SCHEDULE_FIRE_QUEUE } from "@modules/queues/agent-turn"
import { FireStep } from "../../steps/fire.step"

@Injectable()
/** The processor of the fire queue: every slot of every trigger comes here; the runner claims and settles it and `process` delegates to the one step. */
export class FireAgentScheduleProcessor extends FencedProcessor {
    readonly queue = AGENT_SCHEDULE_FIRE_QUEUE

    override readonly job = AGENT_SCHEDULE_FIRE_JOB

    /** The jobs of this queue come from the job schedulers of the trigger rows, so the worker skips the admission against the outbox. */
    override readonly scheduled = true

    constructor(private readonly fire: FireStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.fire.run(job)
    }
}
