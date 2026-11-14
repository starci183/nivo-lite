import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What an open stop takes now. */
export class RunStopNeedsType {
    /** Whether the founder's words (decideRunStop `answer`) move the run. */
    @Field(() => Boolean)
    answer!: boolean

    /** The buttons it accepts (decideRunStop): retry, take_over, skip. */
    @Field(() => [String])
    decisions!: ReadonlyArray<string>

    /** The verdicts it accepts (decideAgentRunStep): approve, refuse. */
    @Field(() => [String])
    verdicts!: ReadonlyArray<string>
}

@ObjectType()
/** One argument of the call an approval asks for. */
export class RunStopArgumentType {
    /** The argument's name. */
    @Field(() => String)
    name!: string

    /** Its value, as text. */
    @Field(() => String)
    value!: string
}

@ObjectType()
/** What an approval asks to do. */
export class RunStopApprovalType {
    /** The owner's work item the verdict goes through. */
    @Field(() => String)
    workItemId!: string

    /** The tool the agent wants to use. */
    @Field(() => String)
    tool!: string

    /** The connected account the call would use. */
    @Field(() => String)
    account!: string

    /** The ability it asks. */
    @Field(() => String)
    ability!: string

    /** The call's arguments. */
    @Field(() => [RunStopArgumentType])
    args!: ReadonlyArray<RunStopArgumentType>
}

@ObjectType()
/** One open stop of a run, with what answering it needs. */
export class RunStopType {
    /** The stop. */
    @Field(() => String)
    stopId!: string

    /** The run that waits. */
    @Field(() => String)
    runId!: string

    /** The step that stopped. */
    @Field(() => String)
    stepKey!: string

    /** approval, ai_report or ai_error. */
    @Field(() => String)
    kind!: string

    /** Why it stopped. */
    @Field(() => String)
    reason!: string

    /** The question for the founder, or null. */
    @Field(() => String, { nullable: true })
    question!: string | null

    /** The AI core's suggested ways on. */
    @Field(() => [String])
    suggestions!: ReadonlyArray<string>

    /** What it takes now. */
    @Field(() => RunStopNeedsType)
    needs!: RunStopNeedsType

    /** What an approval asks to do, or null. */
    @Field(() => RunStopApprovalType, { nullable: true })
    approval!: RunStopApprovalType | null

    /** The agent of the run. */
    @Field(() => String)
    agentId!: string

    /** Its name, or null. */
    @Field(() => String, { nullable: true })
    agentName!: string | null

    /** The workflow the run executes, or null. */
    @Field(() => String, { nullable: true })
    workflowId!: string | null

    /** Its name, or null. */
    @Field(() => String, { nullable: true })
    workflowName!: string | null

    /** The customer, or null. */
    @Field(() => String, { nullable: true })
    contactId!: string | null

    /** Their name, or null. */
    @Field(() => String, { nullable: true })
    contactName!: string | null

    /** The customer conversation, or null. */
    @Field(() => String, { nullable: true })
    conversationId!: string | null

    /** How many times this step of this run stopped. */
    @Field(() => Int)
    repeats!: number

    /** When it last stopped, ISO. */
    @Field(() => String)
    stoppedAt!: string
}

@ObjectType()
/** One page of the open stops. */
export class RunStopsPageType {
    /** The stops, newest first. */
    @Field(() => [RunStopType])
    stops!: ReadonlyArray<RunStopType>

    /** How many stops stand open. */
    @Field(() => Int)
    total!: number

    /** The cursor of the next page, or null. */
    @Field(() => String, { nullable: true })
    next!: string | null
}
