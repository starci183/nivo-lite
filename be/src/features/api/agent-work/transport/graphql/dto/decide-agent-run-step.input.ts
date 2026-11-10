import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"
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

    /** For a run on a thread: the step whose approval is answered; absent answers the run's newest open approval. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    stepKey?: string
}
