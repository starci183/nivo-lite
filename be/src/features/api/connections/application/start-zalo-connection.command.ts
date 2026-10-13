import { Command } from "@nestjs/cqrs"
import type { ZaloWizardConnection } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartZaloConnectionRequest } from "./start-zalo-connection.contracts"

/** Starts a Zalo OA connection from the app keys. */
export class StartZaloConnectionCommand extends Command<ZaloWizardConnection> {
    constructor(readonly params: ExecuteParams<StartZaloConnectionRequest>) {
        super()
    }
}
