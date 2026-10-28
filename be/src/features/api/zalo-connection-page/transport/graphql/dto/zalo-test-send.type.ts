import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a Zalo test send answers. */
export class ZaloTestSendType {
    /** Zalo accepted the message. */
    @Field(() => Boolean)
    sent!: boolean

    /** Why it did not go out. */
    @Field(() => String, { nullable: true })
    failure!: string | null
}
