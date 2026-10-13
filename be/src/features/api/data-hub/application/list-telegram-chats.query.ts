import { Query } from "@nestjs/cqrs"
import type { TelegramChatChoice } from "@modules/domain/data-hub"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ListTelegramChatsRequest } from "./list-telegram-chats.contracts"

/** Lists the recent chats of a Telegram account. */
export class ListTelegramChatsQuery extends Query<ReadonlyArray<TelegramChatChoice>> {
    constructor(readonly params: ExecuteParams<ListTelegramChatsRequest>) {
        super()
    }
}
