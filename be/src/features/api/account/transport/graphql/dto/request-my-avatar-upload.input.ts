import { Field, InputType, Int } from "@nestjs/graphql"
import { IsInt, IsString, Max, MaxLength, Min } from "class-validator"

@InputType()
/** The picture the caller wants to upload, checked before an address is issued. */
export class RequestMyAvatarUploadInput {
    /** The MIME type the browser reports (PNG, JPEG or WebP). */
    @Field()
    @IsString()
    @MaxLength(100)
    contentType!: string

    /** The size in bytes, at most 2 MB. */
    @Field(() => Int)
    @IsInt()
    @Min(1)
    @Max(2_097_152)
    sizeBytes!: number
}
