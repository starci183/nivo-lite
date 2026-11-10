import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeaveWorkspaceRequest } from "./leave-workspace.contracts"

/** Asks to leave a workspace. */
export class LeaveWorkspaceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<LeaveWorkspaceRequest>) {
        super()
    }
}
