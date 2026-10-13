import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** Bounded createVideoMediaUpload arguments. */
export class CreateVideoMediaUploadInput {
    /** name input. */
    @Field(() => String)
    @IsString()
    @MaxLength(200)
    name!: string

    /** type input. */
    @Field(() => String)
    @IsString()
    @MaxLength(100)
    type!: string

    /** size input. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(52428800)
    size!: number
}
