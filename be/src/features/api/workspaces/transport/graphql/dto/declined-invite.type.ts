import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** An invitation the invited person declined. */
export class DeclinedInviteType {
    /** The invitation id. */
    @Field(() => ID)
    id!: string

    /** The invited address. */
    @Field()
    email!: string

    /** `manager` or `staff`. */
    @Field()
    role!: string

    /** When it was declined, ISO 8601. */
    @Field()
    declinedAt!: string
}
