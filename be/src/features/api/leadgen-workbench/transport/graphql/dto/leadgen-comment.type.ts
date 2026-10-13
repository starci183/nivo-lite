import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A drafted public reply waiting for a person's decision. */
export class LeadGenCommentType {
    /** The work item to approve through decideSalesWorkItem. */
    @Field(() => String)
    workItemId!: string
    /** The originating platform. */
    @Field(() => String)
    platform!: string
    /** The comment author's name. */
    @Field(() => String)
    author!: string
    /** The customer's comment. */
    @Field(() => String)
    comment!: string
    /** The proposed reply. */
    @Field(() => String)
    draft!: string
    /** The source's label or reference. */
    @Field(() => String, { nullable: true })
    refLabel!: string | null
    /** The time the reply was proposed. */
    @Field(() => String)
    at!: string
}
