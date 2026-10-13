import { Command } from "@nestjs/cqrs"
import type { ZaloAuthorization } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { BeginZaloAuthorizationRequest } from "./begin-zalo-authorization.contracts"

/** Asks to start the Zalo permission flow of a connection. */
export class BeginZaloAuthorizationCommand extends Command<ZaloAuthorization> {
    constructor(readonly params: ExecuteParams<BeginZaloAuthorizationRequest>) {
        super()
    }
}
