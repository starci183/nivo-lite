import { Field, Int, InputType } from "@nestjs/graphql"
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The written requirements of a job. */
export class HiringJobRequirementsInput {
    /** Skills the job needs. */
    @Field(() => [[String]])
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    skills!: Array<string>

    /** The years of experience asked. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(60)
    experienceYears?: number

    /** A note about the experience. */
    @Field(() => String)
    @IsString()
    @MaxLength(500)
    experienceNote!: string

    /** The days and hours the job needs. */
    @Field(() => [[String]])
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    availability!: Array<string>

    /** Requirements a candidate must meet. */
    @Field(() => [[String]])
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    mustHave!: Array<string>

    /** Requirements that count in a candidate's favour. */
    @Field(() => [[String]])
    @IsArray()
    @ArrayMaxSize(30)
    @IsString({ each: true })
    niceToHave!: Array<string>
}
