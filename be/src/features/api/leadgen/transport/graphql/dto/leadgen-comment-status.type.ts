import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** LeadGenCommentStatus exposed to the workbench. */
export class LeadGenCommentStatusType {
    /** Work-item identity returned by the approval mutation. */
    @Field(() => ID)
    id!: string

    /** Queued, running, succeeded or failed. */
    @Field(() => String)
    status!: string

    /** The underlying work-item state. */
    @Field(() => String)
    workStatus!: string

    /** Where the result can be inspected. */
    @Field(() => String, { nullable: true })
    resultHref!: string | null

    /** Stable error code on a terminal failure. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null
}
