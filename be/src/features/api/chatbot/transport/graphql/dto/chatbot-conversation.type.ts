import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A customer conversation in the workbench inbox. */
export class ChatbotConversationType {
    /** The id value. */
    @Field(() => ID)
    id!: string

    /** The channel value. */
    @Field(() => String)
    channel!: string

    /** The name value. */
    @Field(() => String)
    name!: string

    /** The lead id value. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The last text value. */
    @Field(() => String)
    lastText!: string

    /** The last role value. */
    @Field(() => String, { nullable: true })
    lastRole!: string | null

    /** The last at value. */
    @Field(() => String)
    lastAt!: string

    /** The message count value. */
    @Field(() => Int)
    messageCount!: number

    /** The handled by value. */
    @Field(() => String, { nullable: true })
    handledBy!: string | null

    /** The waiting value. */
    @Field(() => Boolean)
    waiting!: boolean

    /** The unanswered value. */
    @Field(() => Boolean)
    unanswered!: boolean
}
