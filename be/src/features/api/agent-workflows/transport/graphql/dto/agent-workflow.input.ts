import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What agentWorkflow takes. */
export class AgentWorkflowInput {
    /** The installation whose agent holds the workflows. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** The workflow. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    workflowId!: string

    /** The language of the names; Vietnamese unless en is named. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["vi", "en"])
    @MaxLength(2)
    locale?: string | null
}
