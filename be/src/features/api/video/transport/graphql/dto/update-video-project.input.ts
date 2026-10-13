import { Field, ID, InputType, Int } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"
import { VideoInputsInput } from "./video-inputs.input"
import { VideoSceneInput } from "./video-scene.input"

@InputType()
/** Bounded updateVideoProject arguments. */
export class UpdateVideoProjectInput {
    /** projectId input. */
    @Field(() => ID)
    @IsUUID("4")
    @MaxLength(36)
    projectId!: string

    /** title input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    title?: string

    /** goal input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["service", "offer", "testimonial", "behind_scenes", "hiring", "custom"])
    @MaxLength(40)
    goal?: string

    /** aspect input. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["9:16", "1:1", "16:9"])
    @MaxLength(5)
    aspect?: string

    /** targetSeconds input. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(10)
    @Max(90)
    targetSeconds?: number

    /** inputs input. */
    @Field(() => VideoInputsInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => VideoInputsInput)
    inputs?: VideoInputsInput

    /** script input. */
    @Field(() => [VideoSceneInput], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(12)
    @ValidateNested({ each: true })
    @Type(() => VideoSceneInput)
    script?: Array<VideoSceneInput>
}
