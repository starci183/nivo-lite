import { Field, Float, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The owner goals. */
export class DashboardAuthorityType {
    /** The revenue goal in VND, or null. */
    @Field(() => Float, { nullable: true })
    goalRevenueVnd!: number | null

    /** The new customers goal, or null. */
    @Field(() => Int, { nullable: true })
    goalNewCustomers!: number | null

    /** The first reply goal in minutes, or null. */
    @Field(() => Int, { nullable: true })
    goalFirstReplyMinutes!: number | null
}
