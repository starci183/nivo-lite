import { Command } from "@nestjs/cqrs"
import type { AccessGrant } from "@modules/domain/identity"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExchangeRequest } from "./auth.contracts"

/** Signs in with email and password through the local strategy and opens a session. */
export class LoginCommand extends Command<AccessGrant> {
    constructor(readonly params: PublicExecuteParams<ExchangeRequest>) {
        super()
    }
}
