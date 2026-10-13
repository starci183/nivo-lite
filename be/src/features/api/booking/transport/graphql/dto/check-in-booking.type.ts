import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of check in booking. */
export class CheckInBookingType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The fee due. */
    @Field(() => Boolean)
    feeDue!: boolean
}
