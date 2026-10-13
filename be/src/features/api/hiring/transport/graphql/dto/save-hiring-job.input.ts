import { Field, ID, Int, Float, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    IsUUID,
    Max,
    MaxLength,
    Min,
    ValidateNested,
} from "class-validator"
import { HiringJobRequirementsInput } from "./hiring-job-requirements.input"
import { HiringJobQuestionInput } from "./hiring-job-question.input"

@InputType()
/** The bounded arguments that create or update one job post. */
export class SaveHiringJobInput {
    /** The job to update; absent creates one. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID("4")
    @MaxLength(36)
    id?: string

    /** The post title. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    title!: string

    /** The position name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(120)
    position?: string

    /** How the job is worked. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["full_time", "part_time"])
    employmentType?: "full_time" | "part_time"

    /** The work schedule. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    schedule?: string

    /** The lowest pay. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    payMinVnd?: number

    /** The highest pay. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    @Min(0)
    payMaxVnd?: number

    /** The unit of the pay. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["month", "hour", "shift"])
    payUnit?: "month" | "hour" | "shift"

    /** The place of work. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    location?: string

    /** How many people are wanted. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    headcount?: number

    /** The description. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(8000)
    description?: string

    /** The written requirements. */
    @Field(() => HiringJobRequirementsInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => HiringJobRequirementsInput)
    requirements?: HiringJobRequirementsInput

    /** The questions applicants answer. */
    @Field(() => [HiringJobQuestionInput])
    @IsArray()
    @ArrayMaxSize(30)
    @ValidateNested({ each: true })
    @Type(() => HiringJobQuestionInput)
    questions!: Array<HiringJobQuestionInput>

    /** The channels the job takes applications from. */
    @Field(() => [String], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10)
    @IsString({ each: true })
    channels?: Array<string>

    /** When the job stops taking applications. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(40)
    closesAt?: string
}
