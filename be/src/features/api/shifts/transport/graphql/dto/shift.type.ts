import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One shift; an open shift has no person. */
export class ShiftType {
    /** The shift id. */
    @Field(() => ID)
    id!: string

    /** The day, YYYY-MM-DD. */
    @Field(() => String)
    date!: string

    /** The start, HH:MM. */
    @Field(() => String)
    start!: string

    /** The end, HH:MM. */
    @Field(() => String)
    end!: string

    /** The position worked. */
    @Field(() => ID)
    positionId!: string

    /** The person, or null for an open shift. */
    @Field(() => ID, { nullable: true })
    staffId!: string | null

    /** draft, published, swapped or cancelled. */
    @Field(() => String)
    status!: string
}
