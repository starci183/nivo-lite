import { Command } from "@nestjs/cqrs"
import type { BrainChangeDecision } from "@modules/domain/brain"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideBrainChangeRequest } from "./decide-brain-change.contracts"

/** Decides a truth-graph change card: Dong y (the founder) or Khong. */
export class DecideBrainChangeCommand extends Command<BrainChangeDecision> {
    constructor(readonly params: ExecuteParams<DecideBrainChangeRequest>) {
        super()
    }
}
