import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The bounded file facts used to authorize a signed upload for an Office line. */
export class RequestOfficeFileUploadInput {
    /** The accepted type of the file. */
    @Field()
    @IsString()
    @MaxLength(32)
    @IsIn(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    contentType!: string

    /** The file size in bytes, at most ten megabytes. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(10485760)
    sizeBytes!: number
}
