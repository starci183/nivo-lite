import { Query } from "@nestjs/cqrs"
import type { TelegramPageView } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { GetTelegramPageRequest } from "./get-telegram-page.contracts"

/** Asks for the page of a Telegram bot connection. */
export class GetTelegramPageQuery extends Query<TelegramPageView> {
    constructor(readonly params: ExecuteParams<GetTelegramPageRequest>) {
        super()
    }
}
