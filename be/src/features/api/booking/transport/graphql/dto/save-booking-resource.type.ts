import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking resource. */
export class SaveBookingResourceType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
