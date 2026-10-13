import { Command } from "@nestjs/cqrs"
import type { TelegramLoginStarted } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { StartTelegramLoginRequest } from "./start-telegram-login.contracts"

/** Sends the Telegram login code. */
export class StartTelegramLoginCommand extends Command<TelegramLoginStarted> {
    constructor(readonly params: ExecuteParams<StartTelegramLoginRequest>) {
        super()
    }
}
