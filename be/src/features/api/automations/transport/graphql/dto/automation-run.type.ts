import { Field, ID, ObjectType } from "@nestjs/graphql"
import { RunStepType } from "./run-step.type"

@ObjectType()
/** One row of the run history. */
export class AutomationRunType {
    /** The run id. */
    @Field(() => ID)
    id!: string

    /** The pipeline it belongs to. */
    @Field(() => ID)
    pipelineId!: string

    /** The template key. */
    @Field()
    templateKey!: string

    /** `queued`, `running`, `done`, `skipped`, `waiting_approval` or `failed`. */
    @Field()
    status!: string

    /** What triggered it. */
    @Field()
    triggerRef!: string

    /** One line in plain words. */
    @Field()
    summary!: string

    /** The steps. */
    @Field(() => [RunStepType])
    steps!: ReadonlyArray<RunStepType>

    /** Why it did this. */
    @Field(() => String, { nullable: true })
    evidence!: string | null

    /** The error of a failed run. */
    @Field(() => String, { nullable: true })
    error!: string | null

    /** When it started, ISO 8601. */
    @Field()
    createdAt!: string

    /** When it ended, ISO 8601. */
    @Field(() => String, { nullable: true })
    finishedAt!: string | null

    /** The decision it waits for. */
    @Field(() => ID, { nullable: true })
    workItemId!: string | null

    /** The message that was or will be sent. */
    @Field(() => String, { nullable: true })
    message!: string | null
}
