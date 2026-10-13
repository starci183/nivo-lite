import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** How many people one position needs in a time window of a weekday. */
export class ShiftsBlockType {
    /** The coverage row id. */
    @Field(() => ID)
    id!: string

    /** The weekday, 0 Monday to 6 Sunday. */
    @Field(() => Int)
    weekday!: number

    /** The window start, HH:MM. */
    @Field(() => String)
    start!: string

    /** The window end, HH:MM. */
    @Field(() => String)
    end!: string

    /** The position. */
    @Field(() => ID)
    positionId!: string

    /** The fewest people needed. */
    @Field(() => Int)
    min!: number

    /** The ideal number of people. */
    @Field(() => Int)
    ideal!: number

    /** True for a busy window that is filled up to the ideal first. */
    @Field(() => Boolean)
    peak!: boolean
}
