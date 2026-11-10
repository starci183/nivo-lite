import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One channel customers came through. */
export class WorkspaceDashboardChannelType {
    /** The channel key of the lead. */
    @Field()
    channel!: string

    /** Leads created in the period. */
    @Field(() => Int)
    leads!: number

    /** What the paid orders of the channel leads came to in the period, VND. */
    @Field(() => Float)
    revenueVnd!: number
}
