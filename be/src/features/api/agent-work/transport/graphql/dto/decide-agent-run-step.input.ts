import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsUUID, MaxLength } from "class-validator"
import { AgentRunDecisionVerdict } from "./agent-run-decision.type"

@InputType()
/** Answers the decision a run waits on. */
export class DecideAgentRunStepInput {
    /** The agent instance. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    installationId!: string

    /** The run. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    runId!: string

    /** Approve, retry or refuse; only the answers the run offers are taken. */
    @Field(() => AgentRunDecisionVerdict)
    @IsIn(["approve", "retry", "reject"])
    @MaxLength(10)
    verdict!: string
}
