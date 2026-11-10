import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { THREAD_DEADLINE_QUEUE, ThreadDeadlineJob } from "@modules/queues/thread-deadline"
import { FireStep } from "../../steps/fire.step"

@Injectable()
/** The processor of the fire job of the thread-deadline queue: the runner claims and settles it; `process` delegates to the one step. */
export class FireThreadDeadlineProcessor extends FencedProcessor {
    readonly queue: "thread_deadline" = THREAD_DEADLINE_QUEUE

    override readonly job: ThreadDeadlineJob.Fire = ThreadDeadlineJob.Fire

    constructor(private readonly fire: FireStep) {
        super()
    }

    /** Runs the step; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.fire.run(job)
    }
}
