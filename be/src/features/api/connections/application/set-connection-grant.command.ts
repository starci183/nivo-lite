import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SetConnectionGrantRequest } from "./set-connection-grant.contracts"

/** Sets or removes the access of one agent to one connection. */
export class SetConnectionGrantCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SetConnectionGrantRequest>) {
        super()
    }
}
