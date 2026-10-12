import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ZaloAuthorizeRequest, ZaloAuthorizeResult } from "./zalo-authorize.contracts"

/** Starts the Zalo authorization and answers the permission url. */
export class ZaloAuthorizeCommand extends Command<ZaloAuthorizeResult> {
    constructor(readonly params: ExecuteParams<ZaloAuthorizeRequest>) {
        super()
    }
}
