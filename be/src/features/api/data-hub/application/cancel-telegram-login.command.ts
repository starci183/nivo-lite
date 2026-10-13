import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { CancelTelegramLoginRequest } from "./cancel-telegram-login.contracts"

/** Cancels a Telegram login in progress. */
export class CancelTelegramLoginCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<CancelTelegramLoginRequest>) {
        super()
    }
}
