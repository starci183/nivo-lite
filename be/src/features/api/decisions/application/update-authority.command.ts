import { Command } from "@nestjs/cqrs"
import type { AuthorityProfile } from "@modules/domain/authority"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { UpdateAuthorityRequest } from "./update-authority.contracts"

/** Asks to save the changed fields of the authority sheet. */
export class UpdateAuthorityCommand extends Command<AuthorityProfile> {
    constructor(readonly params: ExecuteParams<UpdateAuthorityRequest>) {
        super()
    }
}
