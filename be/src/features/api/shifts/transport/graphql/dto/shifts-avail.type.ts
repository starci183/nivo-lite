import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A statement of when a person can or cannot work. */
export class ShiftsAvailType {
    /** The person. */
    @Field(() => ID)
    staffId!: string

    /** The weekday (0 Monday to 6 Sunday) of a recurring statement; null for a date. */
    @Field(() => Int, { nullable: true })
    weekday!: number | null

    /** The date of a one-day statement; null for a recurring one. */
    @Field(() => String, { nullable: true })
    date!: string | null

    /** The window start, HH:MM. */
    @Field(() => String)
    start!: string

    /** The window end, HH:MM. */
    @Field(() => String)
    end!: string

    /** True when the person can work in the window, false when they cannot. */
    @Field(() => Boolean)
    available!: boolean
}
