import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A follower who wrote inside the free 48 hours. */
export class ZaloRecipientType {
    /** The Zalo user id. */
    @Field(() => String)
    userId!: string

    /** The name Zalo gave, or an empty text. */
    @Field(() => String)
    name!: string

    /** When they last wrote, ISO 8601. */
    @Field(() => String)
    lastMessageAt!: string
}
