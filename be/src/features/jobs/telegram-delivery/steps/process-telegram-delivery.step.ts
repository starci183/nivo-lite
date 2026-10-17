import { Injectable } from "@nestjs/common"
import { TelegramDeliveryService } from "@modules/domain/telegram-inbox"
import type { ClaimedJob, JobStep } from "@modules/platform/jobs"

@Injectable()
/** The fenced step that resolves a committed telegram receipt. */
export class ProcessTelegramDeliveryStep implements JobStep {
    constructor(private readonly delivery: TelegramDeliveryService) {}

    /** Delegates validation, fencing and receipt processing to the domain capability. */
    run(job: ClaimedJob): Promise<void> {
        return this.delivery.process(job)
    }
}
