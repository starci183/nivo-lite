import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The line over the steps: how many steps, decisions people made and minutes. */
export class ChainSummaryType {
    /** How many steps the chain has. */
    @Field(() => Int)
    steps!: number

    /** How many times a person decided. */
    @Field(() => Int)
    humanDecisions!: number

    /** Minutes from the first step to the last. */
    @Field(() => Int)
    minutes!: number

    /** empty, running, stopped or complete. */
    @Field()
    state!: string
}
