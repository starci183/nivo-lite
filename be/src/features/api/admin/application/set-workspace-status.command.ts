import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetWorkspaceStatusRequest, SetWorkspaceStatusResult } from "./set-workspace-status.contracts"

/** Marks a workspace active or past due. */
export class SetWorkspaceStatusCommand extends Command<SetWorkspaceStatusResult> {
    constructor(readonly params: ExecuteParams<SetWorkspaceStatusRequest>) {
        super()
    }
}
