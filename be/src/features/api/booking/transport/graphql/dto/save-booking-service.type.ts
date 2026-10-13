import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking service. */
export class SaveBookingServiceType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
