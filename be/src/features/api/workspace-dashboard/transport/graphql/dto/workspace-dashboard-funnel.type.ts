import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The sales funnel of the period: customers in, advised, ordered, paid. */
export class WorkspaceDashboardFunnelType {
    /** Leads created. */
    @Field(() => Int)
    visitors!: number

    /** Leads taken beyond the first stage. */
    @Field(() => Int)
    consulted!: number

    /** Orders placed. */
    @Field(() => Int)
    ordered!: number

    /** Orders placed that are paid. */
    @Field(() => Int)
    paid!: number
}
