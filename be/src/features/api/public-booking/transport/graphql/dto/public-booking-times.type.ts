import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The currently available starts of an offered service. */
export class PublicBookingTimesType {
    /** Available starts as ISO 8601. */
    @Field(() => [String])
    times!: Array<string>
}
