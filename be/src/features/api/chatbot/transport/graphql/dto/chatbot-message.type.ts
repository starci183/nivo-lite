import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One stored customer, agent or system line. */
export class ChatbotMessageType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The role value. */
    @Field(() => String)
    role!: string

    /** The author kind value. */
    @Field(() => String)
    authorKind!: string

    /** The author name value. */
    @Field(() => String, { nullable: true })
    authorName!: string | null

    /** The body value. */
    @Field(() => String)
    body!: string

    /** The created at value. */
    @Field(() => String)
    createdAt!: string

    /** The delivery value. */
    @Field(() => String, { nullable: true })
    delivery!: string | null

    /** The delivery error value. */
    @Field(() => String, { nullable: true })
    deliveryError!: string | null
}
