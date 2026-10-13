import { Command } from "@nestjs/cqrs"
import type { ZaloAuthorization } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { AuthorizeZaloRequest } from "./authorize-zalo.contracts"

/** Starts the Zalo sign-in of an OA. */
export class AuthorizeZaloCommand extends Command<ZaloAuthorization> {
    constructor(readonly params: ExecuteParams<AuthorizeZaloRequest>) {
        super()
    }
}
