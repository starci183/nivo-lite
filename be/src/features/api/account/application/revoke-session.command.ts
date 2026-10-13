import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RevokeSessionRequest } from "./revoke-session.contracts"

/** Asks to sign another device of the caller's account out. */
export class RevokeSessionCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<RevokeSessionRequest>) {
        super()
    }
}
