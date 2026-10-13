import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One availability statement with its state. */
export class ShiftsAvailabilityType {
    /** The statement id. */
    @Field(() => ID)
    id!: string

    /** The person. */
    @Field(() => ID)
    staffId!: string

    /** The weekday of a recurring statement (0 Monday to 6 Sunday). */
    @Field(() => Int, { nullable: true })
    weekday!: number | null

    /** The date of a one-day statement. */
    @Field(() => String, { nullable: true })
    date!: string | null

    /** The window start, HH:MM. */
    @Field(() => String)
    start!: string

    /** The window end, HH:MM. */
    @Field(() => String)
    end!: string

    /** True when the person can work. */
    @Field(() => Boolean)
    available!: boolean

    /** A free note. */
    @Field(() => String)
    note!: string

    /** pending, approved or declined. */
    @Field(() => String)
    status!: string

    /** When it was filed. */
    @Field(() => String)
    createdAt!: string
}
