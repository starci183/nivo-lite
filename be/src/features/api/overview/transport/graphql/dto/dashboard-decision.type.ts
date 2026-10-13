import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One decision of the history with its customer name. */
export class DashboardDecisionType {
    /** The decision id. */
    @Field(() => ID)
    id!: string

    /** The work item, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The lead, or null. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The customer name, or null. */
    @Field(() => String, { nullable: true })
    leadName!: string | null

    /** The department. */
    @Field()
    department!: string

    /** The flow action. */
    @Field()
    action!: string

    /** Who decided. */
    @Field()
    decidedBy!: string

    /** `policy`, `owner` or `staff`. */
    @Field()
    deciderKind!: string

    /** The outcome. */
    @Field()
    outcome!: string

    /** The reason code, or null. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The note, or null. */
    @Field(() => String, { nullable: true })
    note!: string | null

    /** When it was decided, ISO 8601. */
    @Field()
    createdAt!: string
}
