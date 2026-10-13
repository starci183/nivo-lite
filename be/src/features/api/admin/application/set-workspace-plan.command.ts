import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetWorkspacePlanRequest, SetWorkspacePlanResult } from "./set-workspace-plan.contracts"

/** Moves a workspace to another plan and sets its own monthly credit allowance. */
export class SetWorkspacePlanCommand extends Command<SetWorkspacePlanResult> {
    constructor(readonly params: ExecuteParams<SetWorkspacePlanRequest>) {
        super()
    }
}
