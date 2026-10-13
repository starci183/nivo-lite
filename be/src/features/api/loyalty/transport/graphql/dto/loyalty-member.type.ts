import { Field, ObjectType, ID, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** The loyalty member fields exposed through GraphQL. */
export class LoyaltyMemberType {
    /** The id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The phone. */
    @Field(() => String, { nullable: true })
    phone!: string | null

    /** The email. */
    @Field(() => String, { nullable: true })
    email!: string | null

    /** The birthday. */
    @Field(() => String, { nullable: true })
    birthday!: string | null

    /** The tier key. */
    @Field(() => String, { nullable: true })
    tierKey!: string | null

    /** The points. */
    @Field(() => Float)
    points!: number

    /** The lifetime spend vnd. */
    @Field(() => Float)
    lifetimeSpendVnd!: number

    /** The visits. */
    @Field(() => Int)
    visits!: number

    /** The last visit at. */
    @Field(() => String, { nullable: true })
    lastVisitAt!: string | null

    /** The joined at. */
    @Field(() => String)
    joinedAt!: string

    /** The note. */
    @Field(() => String)
    note!: string
}
