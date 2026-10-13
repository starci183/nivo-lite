import { Command } from "@nestjs/cqrs"
import type { TelegramLoginProgress } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SubmitTelegramCodeRequest } from "./submit-telegram-code.contracts"

/** Submits the Telegram login code. */
export class SubmitTelegramCodeCommand extends Command<TelegramLoginProgress> {
    constructor(readonly params: ExecuteParams<SubmitTelegramCodeRequest>) {
        super()
    }
}
