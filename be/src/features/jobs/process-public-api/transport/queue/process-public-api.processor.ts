import { Injectable } from "@nestjs/common"
import { PublicApiProcessingService } from "@modules/domain/public-api"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import type { QueueDelivery } from "@modules/platform/queue"
import { PUBLIC_API_QUEUE, PublicApiQueueJob } from "@modules/queues/public-api"
import { ProcessPublicApiStep } from "../../steps/process-public-api.step"

@Injectable()
/** Runs public API requests with the standard claim, retry and dead-letter lifecycle. */
export class PublicApiRequestProcessor extends FencedProcessor {
    readonly queue = PUBLIC_API_QUEUE
    override readonly job: string = PublicApiQueueJob.Request
    /** Each fulfillment holds a database connection until its domain transaction commits. */
    override readonly concurrency = 1

    constructor(
        private readonly step: ProcessPublicApiStep,
        private readonly processing: PublicApiProcessingService,
    ) {
        super()
    }

    /** Routes the supported request formats through the fenced fulfillment step. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }

    /** Leaves an exhausted request visible while the transport archives the original delivery. */
    override async onFailed(delivery: QueueDelivery, _cause: unknown): Promise<void> {
        await this.processing.failDelivery(delivery)
    }
}

@Injectable()
/** Retains the original implicit job name while using the same fenced fulfillment and retry lifecycle. */
export class LegacyPublicApiRequestProcessor extends FencedProcessor {
    readonly queue = PUBLIC_API_QUEUE
    override readonly job = PUBLIC_API_QUEUE
    /** Keeps historical deliveries within the same single-connection fulfillment budget. */
    override readonly concurrency = 1

    constructor(
        private readonly step: ProcessPublicApiStep,
        private readonly processing: PublicApiProcessingService,
    ) {
        super()
    }

    /** Routes historical deliveries through the same fenced fulfillment step. */
    async process(job: ClaimedJob): Promise<void> {
        await this.step.run(job)
    }

    /** Preserves terminal failure evidence for an exhausted historical delivery. */
    override async onFailed(delivery: QueueDelivery, _cause: unknown): Promise<void> {
        await this.processing.failDelivery(delivery)
    }
}
