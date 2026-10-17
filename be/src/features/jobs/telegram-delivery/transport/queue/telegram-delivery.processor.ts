import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { TELEGRAM_DELIVERY_QUEUE } from "@modules/queues/telegram-delivery"
import { ProcessTelegramDeliveryStep } from "../../steps/process-telegram-delivery.step"

@Injectable()
/** Consumes the committed telegram receipt using the app's existing fenced job runner. */
export class TelegramDeliveryProcessor extends FencedProcessor {
    readonly queue = TELEGRAM_DELIVERY_QUEUE

    constructor(private readonly delivery: ProcessTelegramDeliveryStep) {
        super()
    }

    /** Refuses malformed messages and stale claims before resolving the pending receipt. */
    async process(job: ClaimedJob): Promise<void> {
        await this.delivery.run(job)
    }
}
