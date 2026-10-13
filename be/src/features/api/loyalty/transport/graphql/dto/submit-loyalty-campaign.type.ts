import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A drafted campaign handed to the approval flow. */
export class SubmitLoyaltyCampaignType {
    /** The campaign. */
    @Field(() => ID)
    campaignId!: string

    /** The work item that records the decision. */
    @Field(() => ID)
    workItemId!: string

    /** The work item status: `waiting_decision` when a person must decide. */
    @Field()
    status!: string
}
