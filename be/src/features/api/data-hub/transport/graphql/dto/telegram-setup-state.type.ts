import { Field, Int, ObjectType } from "@nestjs/graphql"
import { TelegramUserConfigType } from "./telegram-user-config.type"

@ObjectType()
/** Where the personal Telegram wizard continues. */
export class TelegramSetupStateType {
    /** The connection name. */
    @Field(() => String)
    name!: string

    /** pending, connected or error. */
    @Field(() => String)
    status!: string

    /** code or password while a login waits, ready once logged in. */
    @Field(() => String)
    stage!: string

    /** The saved chats, null when none were saved. */
    @Field(() => TelegramUserConfigType, { nullable: true })
    config!: TelegramUserConfigType | null

    /** Minutes between syncs; null is manual only. */
    @Field(() => Int, { nullable: true })
    everyMinutes!: number | null

    /** True when the consent was recorded. */
    @Field(() => Boolean)
    consent!: boolean
}
