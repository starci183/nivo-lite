import { Field, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** Bounded inputs to requestContentQuickDraft. */
export class RequestContentQuickDraftInput {
    /** The pasted idea or topic. */
    @Field()
    @IsString()
    @MinLength(3)
    @MaxLength(12000)
    topic!: string

    /** Channels to draft. */
    @Field(() => [String])
    @IsArray()
    @ArrayMinSize(1)
    @ArrayMaxSize(4)
    @IsIn(["facebook", "zalo", "instagram", "tiktok"], { each: true })
    channels!: Array<string>
}
