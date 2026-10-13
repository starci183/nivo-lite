import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A candidate commercial record proposed for a work item. */
export class LeadFlowCandidateType {
    /** The id of the candidate record. */
    @Field(() => ID)
    id!: string

    /** The display label used to choose the candidate. */
    @Field()
    label!: string

    /** The candidate amount in Vietnamese dong. */
    @Field(() => Float)
    amountVnd!: number
}
