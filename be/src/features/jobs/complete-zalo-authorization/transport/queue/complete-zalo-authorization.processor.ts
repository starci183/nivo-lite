import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { ZALO_AUTHORIZATION_QUEUE } from "@modules/queues/zalo-authorization"
import { CompleteAuthorizationStep } from "../../steps/complete-authorization.step"

@Injectable()
/** The processor of the complete-zalo-authorization job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class CompleteZaloAuthorizationProcessor extends FencedProcessor {
    readonly queue = ZALO_AUTHORIZATION_QUEUE

    constructor(private readonly complete: CompleteAuthorizationStep) {
        super()
    }

    /** Completes the authorization; a stale token throws the fenced-out error from the guarded write before the effect. */
    async process(job: ClaimedJob): Promise<void> {
        await this.complete.run(job)
    }
}
