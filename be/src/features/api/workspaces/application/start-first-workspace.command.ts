import { Command } from "@nestjs/cqrs"
import type { FirstWorkspace } from "@modules/domain/workspaces"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartFirstWorkspaceRequest } from "./start-first-workspace.contracts"

/** Asks for the caller's first workspace at their first sign-in (only where free signup is allowed and they have none). */
export class StartFirstWorkspaceCommand extends Command<FirstWorkspace> {
    constructor(readonly params: ExecuteParams<StartFirstWorkspaceRequest>) {
        super()
    }
}
