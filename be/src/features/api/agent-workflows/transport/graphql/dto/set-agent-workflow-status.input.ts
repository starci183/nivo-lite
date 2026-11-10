import { Field, ID, InputType } from "@nestjs/graphql"
import { IsIn, IsString, IsUUID, MaxLength } from "class-validator"

@InputType()
/** What setAgentWorkflowStatus takes. */
export class SetAgentWorkflowStatusInput {
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

    /** active, draft or paused. */
    @Field(() => String)
    @IsString()
    @IsIn(["active", "draft", "paused"])
    @MaxLength(20)
    status!: string
}
