import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator"
import { AgreedRightInput } from "./agreed-right.input"

@InputType()
/** What publishAgentWorkflowVersion takes. */
export class PublishAgentWorkflowVersionInput {
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

    /** The graph, as JSON text. */
    @Field(() => String)
    @IsString()
    @MaxLength(400000)
    @MinLength(2)
    graphJson!: string

    /** Why the version was made, as the history shows it. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    note!: string

    /** The newest version number the caller read; a newer one refuses the change. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100000)
    expectedLatest?: number | null

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
