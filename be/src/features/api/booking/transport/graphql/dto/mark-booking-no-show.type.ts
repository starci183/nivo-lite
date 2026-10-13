import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of mark booking no show. */
export class MarkBookingNoShowType {
    /** The status. */
    @Field(() => String)
    status!: string

    /** The fee due. */
    @Field(() => Boolean)
    feeDue!: boolean
}
