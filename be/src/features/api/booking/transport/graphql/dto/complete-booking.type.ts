import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of complete booking. */
export class CompleteBookingType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The fee due. */
    @Field(() => Boolean)
    feeDue!: boolean
}
