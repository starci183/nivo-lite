import { Field, ObjectType, Int } from "@nestjs/graphql"

@ObjectType()
/** The booking status count view. */
export class BookingStatusCountType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The count. */
    @Field(() => Int)
    count!: number
}
