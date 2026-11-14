import { Injectable } from "@nestjs/common"
import { PublicApiProcessingService } from "@modules/domain/public-api"
import {
    InjectJobClaims,
    InjectJobFence,
    type ClaimedJob,
    type JobClaims,
    type JobFenceService,
    type JobStep,
} from "@modules/platform/jobs"

@Injectable()
/** Keeps the inbox, request fulfillment and completion inside the live worker's fence. */
export class ProcessPublicApiStep implements JobStep {
    constructor(
        private readonly processing: PublicApiProcessingService,
        @InjectJobClaims() private readonly claims: JobClaims,
        @InjectJobFence() private readonly fence: JobFenceService,
    ) {}

    /** Resolves only supported job names, then supplies the fence-held transaction to the domain owner. */
    run(job: ClaimedJob): Promise<void> {
        return this.processing.processFenced(job, this.claims, this.fence)
    }
}
