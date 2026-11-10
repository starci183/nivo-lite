import { Field, Float, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsNumber,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator"

@InputType()
/** Where one workflow sits on the Graph page. */
export class AgentGraphLayoutPositionInput {
    /** The key of the workflow. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(100)
    workflowKey!: string

    /** The horizontal position. */
    @Field(() => Float)
    @IsNumber()
    @Min(-100000)
    @Max(100000)
    x!: number

    /** The vertical position. */
    @Field(() => Float)
    @IsNumber()
    @Min(-100000)
    @Max(100000)
    y!: number
}

@InputType()
/** What saveAgentGraphLayout takes. */
export class SaveAgentGraphLayoutInput {
    /** The installation whose Graph page is laid out. */
    @Field(() => ID)
    @IsUUID()
    @MaxLength(36)
    installationId!: string

    /** Where each workflow sits; replaces the saved layout whole. */
    @Field(() => [AgentGraphLayoutPositionInput])
    @IsArray()
    @ArrayMaxSize(200)
    @ValidateNested({ each: true })
    @Type(() => AgentGraphLayoutPositionInput)
    positions!: Array<AgentGraphLayoutPositionInput>
}
