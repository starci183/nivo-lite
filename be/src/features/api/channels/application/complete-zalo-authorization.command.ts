import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CompleteZaloAuthorizationRequest } from "./complete-zalo-authorization.contracts"

/** Asks to finish the Zalo permission flow with what Zalo returned; answers the connection id. */
export class CompleteZaloAuthorizationCommand extends Command<string> {
    constructor(readonly params: ExecuteParams<CompleteZaloAuthorizationRequest>) {
        super()
    }
}
