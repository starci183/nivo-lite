import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** References and context produced by a successful lead action. */
export class LeadActionResultType {
    /** The created or processed lead. */
    @Field(() => String, { nullable: true })
    leadId?: string | null

    /** The suggested or selected responsibility. */
    @Field(() => String, { nullable: true })
    responsibilityId?: string | null

    /** The drafted execution. */
    @Field(() => String, { nullable: true })
    executionId?: string | null

    /** The accounting work item created for the won deal. */
    @Field(() => String, { nullable: true })
    workItemId?: string | null

    /** The refreshed sales context summary. */
    @Field(() => String, { nullable: true })
    contextSummary?: string | null
}
