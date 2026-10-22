import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One work thread. */
export class WorkThreadType {
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

    /** The member who opened it. */
    @Field()
    createdBy!: string

    /** When it opened, ISO 8601. */
    @Field()
    createdAt!: string

    /** When it last changed, ISO 8601. */
    @Field()
    updatedAt!: string
}
