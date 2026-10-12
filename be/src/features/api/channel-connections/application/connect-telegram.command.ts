import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConnectTelegramRequest, ConnectTelegramResult } from "./connect-telegram.contracts"

/** Connects a Telegram bot. */
export class ConnectTelegramCommand extends Command<ConnectTelegramResult> {
    constructor(readonly params: ExecuteParams<ConnectTelegramRequest>) {
        super()
    }
}
