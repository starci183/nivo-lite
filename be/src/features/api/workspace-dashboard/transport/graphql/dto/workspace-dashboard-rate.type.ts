import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A share between zero and one, in the period and in the period before it; null while there is nothing to divide by. */
export class WorkspaceDashboardRateType {
    /** In the period. */
    @Field(() => Float, { nullable: true })
    current!: number | null

    /** In the period before. */
    @Field(() => Float, { nullable: true })
    previous!: number | null
}
