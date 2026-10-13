import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of confirm booking. */
export class ConfirmBookingType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The fee due. */
    @Field(() => Boolean)
    feeDue!: boolean
}
