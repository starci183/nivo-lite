import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RestoreWorkspaceRequest } from "./restore-workspace.contracts"

/** Asks to restore a deleted workspace. */
export class RestoreWorkspaceCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RestoreWorkspaceRequest>) {
        super()
    }
}
