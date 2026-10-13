import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AddResponsibilityRequest, AddResponsibilityResult } from "./add-responsibility.contracts"

/** Asks to add the next responsibility of a lead in the workspace of the caller. */
export class AddResponsibilityCommand extends Command<AddResponsibilityResult> {
    constructor(readonly params: ExecuteParams<AddResponsibilityRequest>) {
        super()
    }
}
