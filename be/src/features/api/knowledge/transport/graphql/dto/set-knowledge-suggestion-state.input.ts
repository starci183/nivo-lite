import { Field, InputType } from "@nestjs/graphql"
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** Which suggestion and what was decided about it. */
export class SetKnowledgeSuggestionStateInput {
    /** The key of the suggestion. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(60)
    key!: string

    /** `dismissed` or `not_applicable`; absent brings the suggestion back. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["dismissed", "not_applicable"])
    @MaxLength(40)
    state?: "dismissed" | "not_applicable"
}
