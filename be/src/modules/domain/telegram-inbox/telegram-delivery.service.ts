import { Injectable } from "@nestjs/common"
import { InjectJobClaims } from "@modules/platform/jobs"
import type { ClaimedJob, JobClaims } from "@modules/platform/jobs"
import { isTelegramDeliveryRecorded } from "@modules/queues/telegram-delivery"
import { InjectTelegramReceiptProcessor } from "./telegram-inbox.decorators"
import type { TelegramReceiptProcessor } from "./telegram-inbox.port"

@Injectable()
/** Validates receipt jobs before advancing their fence and consuming the receipt. */
export class TelegramDeliveryService {
    constructor(
        @InjectTelegramReceiptProcessor() private readonly inbox: TelegramReceiptProcessor,
        @InjectJobClaims() private readonly claims: JobClaims,
    ) {}

    /** Invalid references leave the claim untouched; a stale fence prevents every receipt effect. */
    async process(job: ClaimedJob): Promise<void> {
        const payload = job.payload
        if (!isTelegramDeliveryRecorded(payload)) return
        await this.claims.advance({
            jobId: job.jobId,
            expectedFencingToken: job.fencingToken,
            step: "telegram-delivery",
        })
        await this.inbox.processRecordedDelivery(payload)
    }
}
