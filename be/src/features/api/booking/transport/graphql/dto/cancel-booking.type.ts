import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of cancel booking. */
export class CancelBookingType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The fee due. */
    @Field(() => Boolean)
    feeDue!: boolean
}
