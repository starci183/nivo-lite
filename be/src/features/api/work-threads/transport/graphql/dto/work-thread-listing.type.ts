import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A thread in the list with its newest line. */
export class WorkThreadListingType {
    /** The thread id. */
    @Field(() => ID)
    id!: string

    /** The title. */
    @Field()
    title!: string

    /** The lead the thread is about. */
    @Field(() => String, { nullable: true })
    leadId!: string | null

    /** The order the thread is about. */
    @Field(() => String, { nullable: true })
    orderId!: string | null

    /** open, waiting, done or stopped. */
    @Field()
    status!: string

    /** When it opened, ISO 8601. */
    @Field()
    createdAt!: string

    /** When it last changed, ISO 8601. */
    @Field()
    updatedAt!: string

    /** The newest message's text. */
    @Field(() => String, { nullable: true })
    lastBody!: string | null

    /** When the newest message was written, ISO 8601. */
    @Field(() => String, { nullable: true })
    lastAt!: string | null

    /** How many messages the thread has. */
    @Field(() => Int)
    messageCount!: number

    /** True while an approval card of the thread is pending. */
    @Field()
    waitingApproval!: boolean
}
