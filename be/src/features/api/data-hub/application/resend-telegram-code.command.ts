import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ResendTelegramCodeRequest } from "./resend-telegram-code.contracts"

/** Asks Telegram for a fresh login code. */
export class ResendTelegramCodeCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ResendTelegramCodeRequest>) {
        super()
    }
}
