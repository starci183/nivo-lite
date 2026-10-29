import { Command } from "@nestjs/cqrs"
import type { AccessGrant } from "@modules/domain/identity"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { ExchangeRequest } from "./auth.contracts"

/** Rotates the refresh token and answers a new pair. */
export class RefreshCommand extends Command<AccessGrant> {
    constructor(readonly params: PublicExecuteParams<ExchangeRequest>) {
        super()
    }
}
