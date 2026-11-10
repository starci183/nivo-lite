import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What cancelling a run did. */
export class AgentRunCancelType {
    /** "cancelled", or why it was not: already_cancelled, not_cancellable (the run had ended or stopped on a failure) or not_found. */
    @Field(() => String)
    kind!: string

    /** "effects_kept" when the run was cancelled: whatever its steps already sent or did is not undone; null otherwise. */
    @Field(() => String, { nullable: true })
    note!: string | null
}
