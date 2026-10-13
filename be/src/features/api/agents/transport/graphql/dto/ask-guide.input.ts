import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsString, MaxLength, MinLength, ValidateNested } from "class-validator"
import { GuideTurnInput } from "./guide-turn.input"

@InputType()
/** One question to the NIVO guide; the answer is read with `agentGenerationStatus`. */
export class AskGuideInput {
    /** The question as typed. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(2000)
    question!: string

    /** The console path the member is on. */
    @Field()
    @IsString()
    @MaxLength(500)
    path!: string

    /** The last turns of the conversation. */
    @Field(() => [GuideTurnInput])
    @IsArray()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => GuideTurnInput)
    history!: Array<GuideTurnInput>
}
