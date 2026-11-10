import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DecideAgentRunStepOutcome, DecideAgentRunStepRequest } from "./decide-agent-run-step.contracts"

/** Answers the decision a run waits on, from the run page. */
export class DecideAgentRunStepCommand extends Command<DecideAgentRunStepOutcome> {
    constructor(readonly params: ExecuteParams<DecideAgentRunStepRequest>) {
        super()
    }
}
