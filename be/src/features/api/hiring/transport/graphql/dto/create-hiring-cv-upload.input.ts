import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength } from "class-validator"

@InputType()
/** The bounded arguments that get a signed place to upload a CV. */
export class CreateHiringCvUploadInput {
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

    /** The file name. */
    @Field(() => String)
    @IsString()
    @MaxLength(255)
    fileName!: string
}
