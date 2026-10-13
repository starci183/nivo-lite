import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The requested campaign; poll loyaltyCampaign until its message is ready. */
export class DraftCampaignType {
    /** Id accepted by the status query. */
    @Field(() => ID)
    id!: string

    /** Established campaign identifier. */
    @Field(() => ID)
    campaignId!: string

    /** `waiting` while the draft job is queued or running. */
    @Field()
    status!: string

    /** Customers matching the segment at request time. */
    @Field(() => Int)
    recipients!: number

    /** The safe template retained if generation is unavailable. */
    @Field()
    draft!: string
}
