import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetGrantRequest, SetGrantResult } from "./set-grant.contracts"

/** Gives, changes or removes one agent access to one connection (owner only). */
export class SetGrantCommand extends Command<SetGrantResult> {
    constructor(readonly params: ExecuteParams<SetGrantRequest>) {
        super()
    }
}
