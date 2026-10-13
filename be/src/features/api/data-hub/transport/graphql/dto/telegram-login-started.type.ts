import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A started Telegram login. */
export class TelegramLoginStartedType {
    /** The pending connection. */
    @Field(() => ID)
    connectionId!: string

    /** True when the code went to the Telegram app, false when by SMS. */
    @Field(() => Boolean)
    viaApp!: boolean
}
