import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A figure in the period and in the period before it. */
export class WorkspaceDashboardComparedType {
    /** In the period. */
    @Field(() => Float)
    current!: number

    /** In the period before, of the same length. */
    @Field(() => Float)
    previous!: number
}
