import { Query } from "@nestjs/cqrs"
import type { TelegramSetupState } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LoadTelegramUserSetupRequest } from "./load-telegram-user-setup.contracts"

/** Reads where a Telegram connection wizard continues. */
export class LoadTelegramUserSetupQuery extends Query<TelegramSetupState> {
    constructor(readonly params: ExecuteParams<LoadTelegramUserSetupRequest>) {
        super()
    }
}
