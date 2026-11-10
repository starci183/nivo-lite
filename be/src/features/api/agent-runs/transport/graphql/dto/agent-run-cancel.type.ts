import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What cancelling a run did. */
export class AgentRunCancelType {
    /**
     * "cancelled", or why it was not: already_cancelled, not_cancellable (the run had ended or stopped on a failure) or not_found. A
     * parked run is given up for good. A run on a LangGraph thread is cancelled by its stop's skip: "cancelled" once it is queued.
     */
    @Field(() => String)
    kind!: string

    /** "effects_kept" when the run was cancelled: whatever its steps already sent or did is not undone; null otherwise. */
    @Field(() => String, { nullable: true })
    note!: string | null
}
