import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsArray, IsBoolean, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { HiringApplyAnswerInput } from "./hiring-apply-answer.input"

@InputType()
/** The bounded arguments that apply for a job. */
export class ApplyToHiringJobInput {
    /** The workspace slug. */
    @Field(() => String)
    @IsString()
    @MaxLength(80)
    ws!: string

    /** The job slug. */
    @Field(() => String)
    @IsString()
    @MaxLength(120)
    job!: string

    /** The applicant's name. */
    @Field(() => String)
    @IsString()
    @MaxLength(160)
    name!: string

    /** The phone. */
    @Field(() => String)
    @IsString()
    @MaxLength(40)
    phone!: string

    /** The email. */
    @Field(() => String)
    @IsString()
    @MaxLength(254)
    email!: string

    /** The days and hours they can work. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    availability!: string

    /** Whether they agreed that the business stores the application. */
    @Field(() => Boolean)
    @IsBoolean()
    consent!: boolean

    /** The answers. */
    @Field(() => [[HiringApplyAnswerInput]])
    @IsArray()
    @ArrayMaxSize(50)
    @ValidateNested({ each: true })
    @Type(() => HiringApplyAnswerInput)
    answers!: Array<HiringApplyAnswerInput>

    /** The path returned by the upload. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    cvPath?: string

    /** The original file name. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    cvName?: string

    /** A field people leave empty; bots fill it. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    website?: string
}
