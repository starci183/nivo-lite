import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a resume of a parked run did. */
export class AgentRunResumeType {
    /** "resumed", or why it was not: not_found, compensated, not_parked, no_failed_step, exhausted or outcome_unknown. */
    @Field(() => String)
    kind!: string

    /** The step the run goes on from, when it was resumed. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null
}
