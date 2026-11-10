import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { OwnerCancelAnswer } from "@modules/domain/agent-runs"
import type { CancelAgentRunRequest } from "./cancel-agent-run.contracts"

/** Stops a run that is queued, running or waiting; what its steps already sent is not undone. */
export class CancelAgentRunCommand extends Command<OwnerCancelAnswer> {
    constructor(readonly params: ExecuteParams<CancelAgentRunRequest>) {
        super()
    }
}
