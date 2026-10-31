import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CloseAgentTaskRequest } from "./close-agent-task.contracts"

/** Asks to close a task an agent is on. */
export class CloseAgentTaskCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CloseAgentTaskRequest>) {
        super()
    }
}
