import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** GraphQL result of add booking. */
export class AddBookingType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
