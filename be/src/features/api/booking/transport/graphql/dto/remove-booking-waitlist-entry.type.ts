import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The result of remove booking waitlist entry. */
export class RemoveBookingWaitlistEntryType {
    /** The id. */
    @Field(() => ID)
    id!: string
}
