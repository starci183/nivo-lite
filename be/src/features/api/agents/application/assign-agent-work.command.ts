import { Command } from "@nestjs/cqrs"
import type { AssignmentThread } from "@modules/domain/agent-profile"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignAgentWorkRequest } from "./assign-agent-work.contracts"

/** Asks to hand an agent work. */
export class AssignAgentWorkCommand extends Command<AssignmentThread> {
    constructor(readonly params: ExecuteParams<AssignAgentWorkRequest>) {
        super()
    }
}
