import { Command } from "@nestjs/cqrs"
import type { CreatedWorkspace } from "@modules/domain/workspaces"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateWorkspaceRequest } from "./create-workspace.contracts"

/** Asks to create a free workspace owned by the caller (only where the environment allows it). */
export class CreateWorkspaceCommand extends Command<CreatedWorkspace> {
    constructor(readonly params: ExecuteParams<CreateWorkspaceRequest>) {
        super()
    }
}
