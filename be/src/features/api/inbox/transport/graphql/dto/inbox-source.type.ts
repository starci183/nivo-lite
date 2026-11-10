import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Where the customer came from. */
export class InboxSourceType {
    /** The channel key. */
    @Field()
    channel!: string

    /** How the customer arrived on it: form, chat or message. */
    @Field(() => String, { nullable: true })
    via!: string | null

    /** The page of the site the form sat on. */
    @Field(() => String, { nullable: true })
    landing!: string | null

    /** The campaign. */
    @Field(() => String, { nullable: true })
    campaign!: string | null

    /** The device. */
    @Field(() => String, { nullable: true })
    device!: string | null
}
