import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { AgreedRightInput } from "./agreed-right.input"

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

    /**
     * The operations on connected accounts the owner agrees this activation may bring, exactly as the refusal
     * AGENT_GRAPHS_RIGHTS_NEED_OWNER listed them; absent when nothing was asked of the owner.
     */
    @Field(() => [AgreedRightInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(500)
    @ValidateNested({ each: true })
    @Type(() => AgreedRightInput)
    agreedRights?: Array<AgreedRightInput> | null
}
