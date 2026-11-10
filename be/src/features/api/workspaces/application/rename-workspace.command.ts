import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RenameWorkspaceRequest } from "./rename-workspace.contracts"

/** Asks to rename a workspace. */
export class RenameWorkspaceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RenameWorkspaceRequest>) {
        super()
    }
}
