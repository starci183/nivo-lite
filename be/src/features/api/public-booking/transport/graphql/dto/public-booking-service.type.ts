import { Field, ObjectType, ID, Int, Float } from "@nestjs/graphql"

@ObjectType()
/** An active service offered by a published booking page. */
export class PublicBookingServiceType {
    /** The service id. */
    @Field(() => ID)
    id!: string

    /** The service name. */
    @Field()
    name!: string

    /** The service description. */
    @Field()
    description!: string

    /** The service duration in minutes. */
    @Field(() => Int)
    durationMin!: number

    /** The advertised price in VND, when set. */
    @Field(() => Float, { nullable: true })
    priceVnd!: number | null
}
