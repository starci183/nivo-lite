import { Field, Int, ObjectType } from "@nestjs/graphql"
import { TelegramPickedChatType } from "./telegram-picked-chat.type"

@ObjectType()
/** The saved choice of Telegram chats. */
export class TelegramUserConfigType {
    /** The ticked chats. */
    @Field(() => [TelegramPickedChatType])
    chats!: ReadonlyArray<TelegramPickedChatType>

    /** The first sync window in days: 7 or 30. */
    @Field(() => Int)
    sinceDays!: number
}
