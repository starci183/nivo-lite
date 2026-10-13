import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MaintainBrainRequest } from "./maintain-brain.contracts"

/** Asks to bring scheduled and ended facts up to date. */
export class MaintainBrainCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<MaintainBrainRequest>) {
        super()
    }
}
