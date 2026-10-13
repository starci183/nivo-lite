import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A policy or human decision recorded in the lead flow. */
export class LeadFlowDecisionType {
    /** The decision id. */
    @Field(() => ID)
    id!: string

    /** The work item affected by this decision. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The lead affected by this decision. */
    @Field(() => ID, { nullable: true })
    leadId!: string | null

    /** The lead contact name shown in decision history. */
    @Field(() => String, { nullable: true })
    leadName!: string | null

    /** The department responsible for the decided action. */
    @Field()
    department!: string

    /** The registered action covered by the decision. */
    @Field()
    action!: string

    /** The policy or person that made the decision. */
    @Field()
    decidedBy!: string

    /** The kind of decider: policy, owner or staff. */
    @Field()
    deciderKind!: string

    /** The outcome: auto_done, approved, edited or rejected. */
    @Field()
    outcome!: string

    /** The reason code recorded with the decision. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** The optional note recorded by the decider. */
    @Field(() => String, { nullable: true })
    note!: string | null

    /** When the decision was recorded, in ISO 8601 format. */
    @Field()
    createdAt!: string
}
