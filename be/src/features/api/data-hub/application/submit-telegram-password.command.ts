import { Command } from "@nestjs/cqrs"
import type { TelegramLoginProgress } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SubmitTelegramPasswordRequest } from "./submit-telegram-password.contracts"

/** Submits the Telegram two-step password. */
export class SubmitTelegramPasswordCommand extends Command<TelegramLoginProgress> {
    constructor(readonly params: ExecuteParams<SubmitTelegramPasswordRequest>) {
        super()
    }
}
