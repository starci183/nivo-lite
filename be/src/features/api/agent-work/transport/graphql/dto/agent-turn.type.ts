import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One turn as the Work tab lists it: no prompt and no customer words. */
export class AgentTurnType {
    /** The turn. */
    @Field(() => ID)
    id!: string

    /** customer, tag, internal or schedule. */
    @Field()
    source!: string

    /** How the wake ended. */
    @Field()
    wakeStatus!: string

    /** Why it was skipped, held or failed. */
    @Field(() => String, { nullable: true })
    reason!: string | null

    /** Where the turn stands. */
    @Field()
    status!: string

    /** The model. */
    @Field(() => String, { nullable: true })
    model!: string | null

    /** Prompt tokens. */
    @Field(() => Int, { nullable: true })
    promptTokens!: number | null

    /** Completion tokens. */
    @Field(() => Int, { nullable: true })
    completionTokens!: number | null

    /** The provider cost. */
    @Field(() => Float, { nullable: true })
    cost!: number | null

    /** Wall time of the model call. */
    @Field(() => Int, { nullable: true })
    durationMs!: number | null

    /** The work item the turn opened, or null. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** When the wake was written, ISO 8601. */
    @Field(() => Date)
    wokeAt!: Date
}
