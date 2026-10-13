import { Command } from "@nestjs/cqrs"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateResponsibilityStatusRequest } from "./update-responsibility-status.contracts"

/** Asks to move a responsibility to a status. */
export class UpdateResponsibilityStatusCommand extends Command<ResponsibilityRecord> {
    constructor(readonly params: ExecuteParams<UpdateResponsibilityStatusRequest>) {
        super()
    }
}
