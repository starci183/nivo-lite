import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a decision on a truth-graph change card did, and where the card stands. */
export class BrainChangeDecisionType {
    /** `applied`, `rejected`, `founder_only` (a manager pressed Đồng ý), `already_decided` or `not_found`. */
    @Field(() => String)
    outcome!: string

    /** `open`, `applied`, `rejected` or `superseded`; null when there is no card. */
    @Field(() => String, { nullable: true })
    state!: string | null

    /** How many times the card was written; null when there is no card. */
    @Field(() => Int, { nullable: true })
    revision!: number | null
}
