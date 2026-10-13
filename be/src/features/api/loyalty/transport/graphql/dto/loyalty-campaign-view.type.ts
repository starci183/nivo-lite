import { Field, ObjectType, ID, Int } from "@nestjs/graphql"
import { LoyaltySegmentType } from "./loyalty-segment.type"

@ObjectType()
/** The loyalty campaign view fields exposed through GraphQL. */
export class LoyaltyCampaignViewType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The segment. */
    @Field(() => LoyaltySegmentType)
    segment!: LoyaltySegmentType

    /** The message draft. */
    @Field(() => String)
    messageDraft!: string

    /** The message draft alias consumed by the promotion workbench. */
    @Field(() => String)
    draft!: string

    /** The terminal failure code, or null. */
    @Field(() => String, { nullable: true })
    errorCode!: string | null

    /** The status. */
    @Field(() => String)
    status!: string

    /** The recipients. */
    @Field(() => Int)
    recipients!: number

    /** The sent. */
    @Field(() => Int)
    sent!: number

    /** The queued. */
    @Field(() => Int)
    queued!: number

    /** The failed. */
    @Field(() => Int)
    failed!: number

    /** The skipped. */
    @Field(() => Int)
    skipped!: number

    /** The draft ms. */
    @Field(() => Int, { nullable: true })
    draftMs!: number | null

    /** The created by. */
    @Field(() => String)
    createdBy!: string

    /** The created at. */
    @Field(() => String)
    createdAt!: string

    /** The finished at. */
    @Field(() => String, { nullable: true })
    finishedAt!: string | null

    /** The work item id. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null
}
