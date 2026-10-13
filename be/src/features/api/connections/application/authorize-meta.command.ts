import { Command } from "@nestjs/cqrs"
import type { MetaAuthorization } from "@modules/domain/meta-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AuthorizeMetaRequest } from "./authorize-meta.contracts"

/** Starts the Meta login for a new or an existing connection. */
export class AuthorizeMetaCommand extends Command<MetaAuthorization> {
    constructor(readonly params: ExecuteParams<AuthorizeMetaRequest>) {
        super()
    }
}
