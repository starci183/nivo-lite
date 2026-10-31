import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One line of the live Telegram events; it carries no message text. */
export class TelegramEventType {
    /** A stable id of the line. */
    @Field(() => ID)
    id!: string

    /** user_message or agent_reply. */
    @Field(() => String)
    kind!: string

    /** received, sent or not_sent. */
    @Field(() => String)
    outcome!: string

    /** When, ISO 8601. */
    @Field(() => String)
    at!: string

    /** The customer's chat id with its middle hidden, or an empty text. */
    @Field(() => String)
    who!: string

    /** Why a reply was not sent. */
    @Field(() => String, { nullable: true })
    reason!: string | null
}
