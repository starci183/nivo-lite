import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Website lead facts used by the promo cards. */
export class WebsiteLeadStatsType {
    /** The number of website leads. */
    @Field(() => Int)
    count!: number

    /** Leads captured before 08:00 or after 18:00 in the product timezone. */
    @Field(() => Int)
    afterHoursCount!: number

    /** Mean delay to the earliest approval or assignment, when one exists. */
    @Field(() => Float, { nullable: true })
    avgWaitHours!: number | null
}
