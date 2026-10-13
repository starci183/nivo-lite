import { Field, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from "class-validator"
import { VideoInputsInput } from "./video-inputs.input"

@InputType()
/** Bounded createVideoProject arguments. */
export class CreateVideoProjectInput {
    /** title input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    title?: string

    /** goal input. */
    @Field(() => String)
    @IsIn(["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"])
    @MaxLength(40)
    goal!: string

    /** aspect input. */
    @Field(() => String)
    @IsIn(["9:16", "1:1", "16:9"])
    @MaxLength(5)
    aspect!: string

    /** targetSeconds input. */
    @Field(() => Int)
    @IsInt()
    @Min(10)
    @Max(90)
    targetSeconds!: number

    /** inputs input. */
    @Field(() => VideoInputsInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => VideoInputsInput)
    inputs?: VideoInputsInput
}
