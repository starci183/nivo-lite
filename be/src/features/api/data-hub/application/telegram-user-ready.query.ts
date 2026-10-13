import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { TelegramUserReadyRequest } from "./telegram-user-ready.contracts"

/** Asks whether this deployment can log in a personal Telegram account. */
export class TelegramUserReadyQuery extends Query<boolean> {
    constructor(readonly params: ExecuteParams<TelegramUserReadyRequest>) {
        super()
    }
}
