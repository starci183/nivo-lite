import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { INVENTORY_REPLENISH_QUEUE } from "@modules/queues/inventory-replenish"
import { ReplenishStep } from "../../steps/replenish.step"

@Injectable()
/** The processor of the replenish-stock job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class ReplenishStockProcessor extends FencedProcessor {
    readonly queue = INVENTORY_REPLENISH_QUEUE

    constructor(private readonly replenish: ReplenishStep) {
        super()
    }

    /** Drafts the orders; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.replenish.run(job)
    }
}
