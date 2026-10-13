import { Field, ID, Int, Float, ObjectType } from "@nestjs/graphql"
import { GraphqlJsonObject } from "@modules/platform/graphql"

@ObjectType()
/** One schedule in full. */
export class ShiftsScheduleType {
    /** The schedule id. */
    @Field(() => ID)
    id!: string

    /** The version number. */
    @Field(() => Int)
    version!: number

    /** draft, published or superseded. */
    @Field(() => String)
    status!: string

    /** The estimated wage cost. */
    @Field(() => Float)
    costVnd!: number

    /** When it was made. */
    @Field(() => String)
    createdAt!: string

    /** When it was published. */
    @Field(() => String, { nullable: true })
    publishedAt!: string | null

    /** The Monday of the week. */
    @Field(() => String)
    weekStart!: string

    /** solver or manual. */
    @Field(() => String)
    source!: string

    /** The written explanation. */
    @Field(() => String)
    explanation!: string

    /** How long the solver ran. */
    @Field(() => Int, { nullable: true })
    solverMs!: number | null

    /** Coverage and hours counts. */
    @Field(() => GraphqlJsonObject)
    summary!: object

    /** What the solver and the checks found. */
    @Field(() => GraphqlJsonObject)
    evidence!: object

    /** The publish decision. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null
}
