import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking exception. */
export class SaveBookingExceptionType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
