import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of remove booking resource. */
export class RemoveBookingResourceType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
