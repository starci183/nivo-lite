import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of remove booking service. */
export class RemoveBookingServiceType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
