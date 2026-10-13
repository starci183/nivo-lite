import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The hiring figures of the ribbon. */
export class HiringFiguresType {
    /** Jobs open now. */
    @Field(() => Int)
    openRoles!: number

    /** All jobs. */
    @Field(() => Int)
    totalRoles!: number

    /** Candidates still moving through the pipeline. */
    @Field(() => Int)
    pipeline!: number

    /** Confirmed interviews this week, Vietnam calendar. */
    @Field(() => Int)
    interviewsWeek!: number

    /** Offers waiting for the manager's approval. */
    @Field(() => Int)
    offersWaiting!: number

    /** Offers sent, waiting for the candidate. */
    @Field(() => Int)
    offersSent!: number
}
