import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of save booking hours. */
export class SaveBookingHoursType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
