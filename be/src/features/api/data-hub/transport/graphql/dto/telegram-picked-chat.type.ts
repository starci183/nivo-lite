import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A chat the owner ticked. */
export class TelegramPickedChatType {
    /** The Telegram chat id. */
    @Field(() => String)
    id!: string

    /** The chat title. */
    @Field(() => String)
    title!: string

    /** user, group or channel. */
    @Field(() => String)
    kind!: string
}
