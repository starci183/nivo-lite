import { Field, ObjectType, ID } from "@nestjs/graphql"

@ObjectType()
/** The recorded booking request and offered alternatives. */
export class RequestPublicBookingType {
    /** The booking outcome state. */
    @Field()
    state!: string

    /** The outcome code for visitor copy. */
    @Field()
    code!: string

    /** The booked service name. */
    @Field()
    serviceName!: string

    /** The requested start as ISO 8601. */
    @Field()
    startIso!: string

    /** Alternative starts when the requested time was taken. */
    @Field(() => [String])
    alternatives!: ReadonlyArray<string>

    /** The recorded booking id, when one was created. */
    @Field(() => ID, { nullable: true })
    bookingId!: string | null
}
