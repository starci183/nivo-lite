import { Field, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Why the stop door took nothing although the stop is open: the person's decision belongs at another door, named here. */
export class AgentRunStopRefusalType {
    /** The stop that waits. */
    @Field(() => ID)
    stopId!: string

    /** The owner's work item whose verdict the stop waits for: what the approval door answers. */
    @Field(() => ID)
    workItemId!: string

    /** The door that takes the decision: the name of its mutation (`decideAgentRunStep`). */
    @Field(() => String)
    door!: string

    /** The verdicts that door takes. */
    @Field(() => [String])
    verdicts!: ReadonlyArray<string>
}

@ObjectType()
/** What a decision on the stop of a thread run did. */
export class AgentRunStopDecisionType {
    /**
     * "admitted" (the thread applies it now), or why not: already_admitted (the same decision is already queued), already_answered
     * (someone already answered this stop with another decision; that one is applied), stop_closed
     * (the stop was resolved: nothing moved), step_running (the step runs again after an earlier answer), not_stopped, not_thread (a run
     * of the old engine: its own doors answer it), not_found or invalid (no such action, or an answer with no words), approval_pending
     * (the stop waits for the owner's verdict on a permission request: nothing moved; `refusal` names the door that takes it).
     */
    @Field(() => String)
    outcome!: string

    /** The step of the stop, when one was found. */
    @Field(() => String, { nullable: true })
    stepKey!: string | null

    /** For approval_pending: the stop, its work item, and the door and verdicts that answer it; null (or absent) for every other outcome. */
    @Field(() => AgentRunStopRefusalType, { nullable: true })
    refusal?: AgentRunStopRefusalType | null | undefined
}
