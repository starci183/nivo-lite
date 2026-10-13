import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AssignResponsibilityRequest, AssignResponsibilityResult } from "./assign-responsibility.contracts"

/** Asks to reassign a responsibility of the workspace of the caller. */
export class AssignResponsibilityCommand extends Command<AssignResponsibilityResult> {
    constructor(readonly params: ExecuteParams<AssignResponsibilityRequest>) {
        super()
    }
}
