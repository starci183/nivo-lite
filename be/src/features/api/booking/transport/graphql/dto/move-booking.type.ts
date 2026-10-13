import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of move booking. */
export class MoveBookingType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
