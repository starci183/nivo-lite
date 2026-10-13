import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of remove booking exception. */
export class RemoveBookingExceptionType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
