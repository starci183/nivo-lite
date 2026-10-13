import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One coverage block the quick import text describes. */
export class PreviewShiftsBlockType {
    /** The weekday, 0 Monday to 6 Sunday. */
    @Field(() => Int)
    weekday!: number

    /** The window start, HH:MM. */
    @Field()
    start!: string

    /** The window end, HH:MM. */
    @Field()
    end!: string

    /** The position name. */
    @Field()
    position!: string

    /** The fewest people. */
    @Field(() => Int)
    min!: number

    /** The ideal people. */
    @Field(() => Int)
    ideal!: number

    /** True for a peak window. */
    @Field()
    peak!: boolean
}
