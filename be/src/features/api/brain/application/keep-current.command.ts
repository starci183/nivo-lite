import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { KeepCurrentRequest } from "./keep-current.contracts"

/** Asks to keep the value in force and reject every waiting value of its key. */
export class KeepCurrentCommand extends Command<number> {
    constructor(readonly params: ExecuteParams<KeepCurrentRequest>) {
        super()
    }
}
