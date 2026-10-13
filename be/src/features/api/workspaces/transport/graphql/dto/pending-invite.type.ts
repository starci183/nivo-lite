import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A pending invitation as the team page lists it. */
export class PendingInviteType {
    /** The invitation id. */
    @Field(() => ID)
    id!: string

    /** The invited address. */
    @Field()
    email!: string

    /** `manager` or `staff`. */
    @Field()
    role!: string

    /** The staff row it links, when any. */
    @Field(() => ID, { nullable: true })
    staffId!: string | null

    /** When it was issued, ISO 8601. */
    @Field()
    createdAt!: string

    /** When the link stops working, ISO 8601. */
    @Field()
    expiresAt!: string
}
