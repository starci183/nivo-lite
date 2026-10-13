import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { SaveTelegramUserSetupRequest } from "./save-telegram-user-setup.contracts"

/** Saves the chosen Telegram chats and schedule. */
export class SaveTelegramUserSetupCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<SaveTelegramUserSetupRequest>) {
        super()
    }
}
