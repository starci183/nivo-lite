import { Command } from "@nestjs/cqrs"
import type { ZaloPageView } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { RecheckZaloConnectionRequest } from "./recheck-zalo-connection.contracts"

/** Asks for the check of a Zalo OA connection, run again. */
export class RecheckZaloConnectionCommand extends Command<ZaloPageView> {
    constructor(readonly params: ExecuteParams<RecheckZaloConnectionRequest>) {
        super()
    }
}
