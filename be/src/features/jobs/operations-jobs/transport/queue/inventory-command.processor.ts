import { Injectable } from "@nestjs/common"
import { FencedProcessor } from "@modules/platform/jobs"
import type { ClaimedJob } from "@modules/platform/jobs"
import { INVENTORY_COMMAND_QUEUE } from "@modules/queues/inventory-command"
import { RunInventoryCommandStep } from "../../steps/run-inventory-command.step"

@Injectable()
/** The processor of the inventory-command job: the runner claims and settles it; `process` delegates the fenced claim to the one step. */
export class InventoryCommandProcessor extends FencedProcessor {
    readonly queue = INVENTORY_COMMAND_QUEUE

    constructor(private readonly runCommand: RunInventoryCommandStep) {
        super()
    }

    /** Runs the command; a stale token throws the fenced-out error from the guarded write before the effect and nothing else happens. */
    async process(job: ClaimedJob): Promise<void> {
        await this.runCommand.run(job)
    }
}
