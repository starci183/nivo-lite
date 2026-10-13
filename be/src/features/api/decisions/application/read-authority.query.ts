import { Query } from "@nestjs/cqrs"
import type { AuthoritySheet } from "@modules/domain/decisions"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ReadAuthorityRequest } from "./read-authority.contracts"

/** Asks for the goals, house rules and every rule of the workspace. */
export class ReadAuthorityQuery extends Query<AuthoritySheet> {
    constructor(readonly params: ExecuteParams<ReadAuthorityRequest>) {
        super()
    }
}
