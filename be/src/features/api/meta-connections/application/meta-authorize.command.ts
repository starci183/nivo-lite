import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MetaAuthorizeRequest, MetaAuthorizeResult } from "./meta-authorize.contracts"

/** Starts the Meta login. */
export class MetaAuthorizeCommand extends Command<MetaAuthorizeResult> {
    constructor(readonly params: ExecuteParams<MetaAuthorizeRequest>) {
        super()
    }
}
