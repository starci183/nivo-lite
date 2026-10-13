import { Command } from "@nestjs/cqrs"
import type { ResponsibilityRecord } from "@modules/domain/responsibilities"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CreateResponsibilityRequest } from "./create-responsibility.contracts"

/** Asks to add a responsibility for a customer. */
export class CreateResponsibilityCommand extends Command<ResponsibilityRecord> {
    constructor(readonly params: ExecuteParams<CreateResponsibilityRequest>) {
        super()
    }
}
