import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MaintainBrainRequest } from "./maintain-brain.contracts"

/** Keeps the brain current: scheduled values take over and ended values expire. */
export class MaintainBrainCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<MaintainBrainRequest>) {
        super()
    }
}
