import { Field, ObjectType, ID, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking board hours view. */
export class BookingBoardHoursType {
    /** The resource id. */
    @Field(() => ID)
    resourceId!: string

    /** The weekday. */
    @Field(() => Int)
    weekday!: number

    /** The start. */
    @Field(() => String)
    start!: string

    /** The end. */
    @Field(() => String)
    end!: string
}
