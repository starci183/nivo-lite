import { Command } from "@nestjs/cqrs"
import type { AgentWorkSettingsRecord } from "@modules/domain/agent-work"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetWorkspaceAgentWorkRequest } from "./set-workspace-agent-work.contracts"

/** Asks to switch work on or off for every agent of the workspace. */
export class SetWorkspaceAgentWorkCommand extends Command<AgentWorkSettingsRecord> {
    constructor(readonly params: ExecuteParams<SetWorkspaceAgentWorkRequest>) {
        super()
    }
}
