import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsString, Max, MaxLength, Min, MinLength } from "class-validator"

@InputType()
/** The bounded media file facts used to authorize a signed upload. */
export class RequestContentMediaUploadInput {
    /** The original file name. */
    @Field()
    @IsString()
    @MinLength(1)
    @MaxLength(255)
    name!: string

    /** The accepted MIME type of the uploaded file. */
    @Field()
    @IsString()
    @MaxLength(32)
    @IsIn(["image/jpeg", "image/png", "image/webp", "video/mp4"])
    contentType!: string

    /** The file size in bytes, at most ten megabytes. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(10485760)
    sizeBytes!: number
}
