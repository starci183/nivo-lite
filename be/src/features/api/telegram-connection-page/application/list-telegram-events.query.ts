import { Query } from "@nestjs/cqrs"
import type { TelegramPageEvent } from "@modules/domain/channels"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListTelegramEventsRequest } from "./list-telegram-events.contracts"

/** Asks for the live events of a Telegram bot connection. */
export class ListTelegramEventsQuery extends Query<ReadonlyArray<TelegramPageEvent>> {
    constructor(readonly params: ExecuteParams<ListTelegramEventsRequest>) {
        super()
    }
}
