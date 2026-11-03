import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** One version of a template. */
export class TemplateVersionRefInput {
    /** The template key. */
    @Field(() => String)
    @IsString()
    @MaxLength(60)
    templateKey!: string

    /** The version. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(100_000)
    version!: number
}
