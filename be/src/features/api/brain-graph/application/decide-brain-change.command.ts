import { Command } from "@nestjs/cqrs"
import type { BrainChangeDecision } from "@modules/domain/brain/brain-change-messages.service"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideBrainChangeRequest } from "./decide-brain-change.contracts"

/** Decides a truth-graph change card: Đồng ý (the founder) or Không. */
export class DecideBrainChangeCommand extends Command<BrainChangeDecision> {
    constructor(readonly params: ExecuteParams<DecideBrainChangeRequest>) {
        super()
    }
}
