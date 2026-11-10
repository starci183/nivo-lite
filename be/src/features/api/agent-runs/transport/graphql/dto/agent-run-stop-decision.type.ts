import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What a decision on the stop of a thread run did. */
export class AgentRunStopDecisionType {
    /**
     * "admitted" (the thread applies it now), or why not: already_admitted (a decision is already queued for this stop), stop_closed
     * (the stop was resolved: nothing moved), step_running (the step runs again after an earlier answer), not_stopped, not_thread (a run
     * of the old engine: its own doors answer it), not_found or invalid (no such action, or an answer with no words).
     */
    @Field(() => String)
    outcome!: string

    /** The step of the stop, when one was found. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null
}
