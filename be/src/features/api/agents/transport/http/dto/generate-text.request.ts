import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    ArrayMinSize,
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

/** One line of the prompt of a generation. */
export class GenMessageRequest {
    /** Who speaks the line. */
    @IsIn(["system", "user", "assistant"])
    role!: "system" | "user" | "assistant"

    /** The text of the line. */
    @IsString()
    @MaxLength(60000)
    content!: string
}

/** The bounded HTTP request that asks the agent engine to write a text. */
export class GenerateTextRequest {
    /** What the text is for; the usage page groups by it. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(60)
    purpose!: string

    /** The prompt: system instructions, the dialogue so far and the input. */
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(60)
    @ValidateNested({ each: true })
    @Type(() => GenMessageRequest)
    messages!: Array<GenMessageRequest>

    /** Text or one JSON object. */
    @IsIn(["text", "json"])
    responseFormat!: "text" | "json"

    /** How long to wait, ms; the default when absent. */
    @IsOptional()
    @IsInt()
    @Min(5000)
    @Max(120000)
    timeoutMs?: number

    /** The usage kind the metering records the text under. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(40)
    kind!: string

    /** The usage module the metering records the text under. */
    @IsString()
    @Matches(/^[a-z0-9_]+$/)
    @MinLength(1)
    @MaxLength(40)
    module!: string
}
