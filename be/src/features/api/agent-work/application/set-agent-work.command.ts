import { Command } from "@nestjs/cqrs"
import type { AgentWorkState } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetAgentWorkRequest } from "./set-agent-work.contracts"

/** Asks to switch work on or off for one agent. */
export class SetAgentWorkCommand extends Command<AgentWorkState> {
    constructor(readonly params: ExecuteParams<SetAgentWorkRequest>) {
        super()
    }
}
