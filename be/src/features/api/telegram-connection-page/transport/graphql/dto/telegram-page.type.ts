import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The page of one Telegram bot connection; the bot token never leaves. */
export class TelegramPageType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The name the owner gave. */
    @Field(() => String)
    name!: string

    /** The status of the connection. */
    @Field(() => String)
    status!: string

    /** The connection is connected and reports no error. */
    @Field(() => Boolean)
    healthy!: boolean

    /** The bot's username, or an empty text. */
    @Field(() => String)
    botUsername!: string

    /** The webhook address NIVO registered with Telegram. */
    @Field(() => String)
    webhookUrl!: string

    /** The code of the last failure, which the page words. */
    @Field(() => String, { nullable: true })
    lastError!: string | null

    /** When the last event arrived, ISO 8601. */
    @Field(() => String, { nullable: true })
    lastEventAt!: string | null

    /** The agents that use the connection. */
    @Field(() => [ID])
    agentIds!: Array<string>
}
