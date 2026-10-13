import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Whether personal Telegram login is available on this deployment. */
export class TelegramUserReadyType {
    /** True when the Telegram app credentials are set. */
    @Field(() => Boolean)
    configured!: boolean
}
