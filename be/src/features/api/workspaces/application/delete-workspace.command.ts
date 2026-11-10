import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { DeleteWorkspaceRequest } from "./delete-workspace.contracts"

/** Asks to delete a workspace. */
export class DeleteWorkspaceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<DeleteWorkspaceRequest>) {
        super()
    }
}
