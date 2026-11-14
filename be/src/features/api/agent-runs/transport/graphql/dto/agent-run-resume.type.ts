import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a resume of a parked run did. */
export class AgentRunResumeType {
    /**
     * "resumed", or why it was not: not_found, not_parked, no_failed_step, exhausted, outcome_unknown, or thread_run (a run
     * on a LangGraph thread: its stop is answered with decideRunStop).
     */
    @Field(() => String)
    kind!: string

    /** The step the run goes on from, when it was resumed. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null
}
