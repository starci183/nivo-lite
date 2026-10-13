import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** A question customers asked that the brain could not answer. */
export class BrainGapType {
    /** The gap id. */
    @Field(() => ID)
    id!: string

    /** The customer-facing agent that could not answer. */
    @Field(() => String)
    module!: string

    /** The question as first asked. */
    @Field(() => String)
    question!: string

    /** The subject guess. */
    @Field(() => String, { nullable: true })
    topic?: string | null

    /** The attribute guess. */
    @Field(() => String, { nullable: true })
    attributeGuess?: string | null

    /** How many times it was asked. */
    @Field(() => Int)
    count!: number

    /** When it was last asked, ISO 8601. */
    @Field(() => String)
    lastSeenAt!: string

    /** How many times it was asked again after being answered. */
    @Field(() => Int)
    reopenedCount!: number
}
