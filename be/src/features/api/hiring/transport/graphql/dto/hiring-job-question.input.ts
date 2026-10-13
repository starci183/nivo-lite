import { Field, Float, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsString, MaxLength } from "class-validator"

@InputType()
/** One question of a job. */
export class HiringJobQuestionInput {
    /** The question id inside the job; empty gets a generated one. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(60)
    id?: string

    /** The question text. */
    @Field(() => String)
    @IsString()
    @MaxLength(1000)
    text!: string

    /** The kind of answer. */
    @Field(() => String)
    @IsIn(["text", "yesno", "number", "choice"])
    type!: "text" | "yesno" | "number" | "choice"

    /** Whether an answer is required. */
    @Field(() => Boolean)
    @IsBoolean()
    required!: boolean

    /** The offered choices of a choice question. */
    @Field(() => [[String]], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    choices?: Array<string>

    /** The expected answer of a yes or no question. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsIn(["yes", "no"])
    expectYesNo?: "yes" | "no"

    /** The minimum of a number question. */
    @Field(() => Float, { nullable: true })
    @IsOptional()
    @IsNumber()
    expectNumber?: number

    /** The accepted choices of a choice question. */
    @Field(() => [[String]], { nullable: true })
    @IsOptional()
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    expectChoices?: Array<string>
}
