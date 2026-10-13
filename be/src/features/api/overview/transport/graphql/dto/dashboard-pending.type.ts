import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One draft waiting for a decision. */
export class DashboardPendingType {
    /** The execution id. */
    @Field(() => ID)
    id!: string

    /** The responsibility it belongs to. */
    @Field(() => ID)
    responsibilityId!: string

    /** When it was drafted, ISO 8601. */
    @Field()
    createdAt!: string

    /** The lead behind it, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null
}
