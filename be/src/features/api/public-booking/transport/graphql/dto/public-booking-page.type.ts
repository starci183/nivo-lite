import { Field, ObjectType } from "@nestjs/graphql"
import { PublicBookingServiceType } from "./public-booking-service.type"

@ObjectType()
/** The published booking page and its active services. */
export class PublicBookingPageType {
    /** The shop name. */
    @Field()
    shop!: string

    /** The published slug. */
    @Field()
    slug!: string

    /** The public note. */
    @Field()
    note!: string

    /** The public shop address. */
    @Field()
    address!: string

    /** The booking timezone. */
    @Field()
    timezone!: string

    /** The services the visitor can book. */
    @Field(() => [PublicBookingServiceType])
    services!: Array<PublicBookingServiceType>
}
