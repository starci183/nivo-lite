import { Command } from "@nestjs/cqrs"
import type { TelegramConnected } from "@modules/domain/channel-connections"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ConnectTelegramRequest } from "./connect-telegram.contracts"

/** Connects a Telegram bot from its token. */
export class ConnectTelegramCommand extends Command<TelegramConnected> {
    constructor(readonly params: ExecuteParams<ConnectTelegramRequest>) {
        super()
    }
}
