import { Field, InputType, Int } from "@nestjs/graphql"
import { Transform, Type } from "class-transformer"
import type { TransformFnParams } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
    MinLength,
    ValidateNested,
} from "class-validator"
import { AgentGenMessageInput } from "./agent-gen-message.input"

@InputType()
/** Asks the agent engine to write a text; the text is read with `agentGenerationStatus`. */
export class RequestAgentGenerationInput {
    /** What the text is for; the usage page groups by it. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    purpose!: string

    /** The prompt: system instructions, the dialogue so far and the input. */
    @Field(() => [AgentGenMessageInput])
    @IsArray()
    @ArrayMaxSize(60)
    @ValidateNested({ each: true })
    @Type(() => AgentGenMessageInput)
    messages!: Array<AgentGenMessageInput>

    /** Text or one JSON object. */
    @Field()
    @IsIn(["text", "json"])
    responseFormat!: "text" | "json"

    /** How long the text may take, ms; the default when absent. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @Transform(({ value }: TransformFnParams): unknown => value ?? undefined)
    @IsInt()
    @Min(5000)
    @Max(120000)
    timeoutMs?: number

    /** The usage kind the metering records the text under. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(40)
    kind!: string

    /** The usage module the metering records the text under. */
    @Field()
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(40)
    module!: string
}
