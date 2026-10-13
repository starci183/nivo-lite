import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One chat of the account, for the picker. */
export class TelegramChatChoiceType {
    /** The Telegram chat id. */
    @Field(() => String)
    id!: string

    /** The chat title. */
    @Field(() => String)
    title!: string

    /** user, group or channel. */
    @Field(() => String)
    kind!: string

    /** Unread messages. */
    @Field(() => Int)
    unread!: number
}
