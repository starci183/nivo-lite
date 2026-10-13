import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The next step of a Telegram login. */
export class TelegramLoginStageType {
    /** password when two-step verification is needed, ready when logged in. */
    @Field(() => String)
    stage!: string
}
