import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One emoji on a message, summed over the members. */
export class ChatReactionType {
    /** The emoji. */
    @Field(() => String)
    emoji!: string

    /** How many times everyone tapped it. */
    @Field(() => Int)
    count!: number

    /** Whether the caller tapped it. */
    @Field(() => Boolean)
    mine!: boolean

    /** How many times the caller tapped it. */
    @Field(() => Int)
    mineCount!: number
}
