import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The lesson an owner or manager writes. */
export class SaveBrainLessonInput {
    /** The agent it is for; omitted = every agent. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MinLength(1)
    @MaxLength(64)
    module?: string

    /** The title. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    title!: string

    /** What to do. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(4000)
    body!: string

    /** When it applies. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    appliesWhen?: string
}
