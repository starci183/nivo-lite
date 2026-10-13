import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The durable polling id and the related content item. */
export class ContentAiRequestedType {
    /** The job to poll. */
    @Field()
    id!: string

    /** Initially queued. */
    @Field()
    status!: string

    /** An idea or draft id; absent for a plan request. */
    @Field(() => String, { nullable: true })
    itemId!: string | null
}
