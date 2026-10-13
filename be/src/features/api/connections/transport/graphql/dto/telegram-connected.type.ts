import { Field, ObjectType } from "@nestjs/graphql"
import { ConnectionType } from "./connection.type"

@ObjectType()
/** What connecting a Telegram bot answers. */
export class TelegramConnectedType {
    /** The new connection. */
    @Field(() => ConnectionType)
    connection!: ConnectionType

    /** False on a local site, where the webhook is registered later. */
    @Field(() => Boolean)
    webhookRegistered!: boolean
}
