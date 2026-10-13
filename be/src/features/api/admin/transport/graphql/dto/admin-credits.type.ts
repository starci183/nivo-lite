import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The month's AI credits against the allowance. */
export class AdminCreditsType {
    /** The used. */
    @Field(() => Float)
    used!: number

    /** The limit. */
    @Field(() => Float, { nullable: true })
    limit!: number | null

    /** The cost usd. */
    @Field(() => Float)
    costUsd!: number

    /** The own limit. */
    @Field(() => Float, { nullable: true })
    ownLimit!: number | null
}
