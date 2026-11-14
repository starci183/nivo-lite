import { Field, InputType, Int } from "@nestjs/graphql"
import { IsIn, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

@InputType()
/** The name and content type of the file to upload. */
export class CreateKnowledgeUploadInput {
    /** The file name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    filename!: string

    /** The content type the browser reports for the file; may be empty. */
    @Field(() => String)
    @IsString()
    @MaxLength(100)
    contentType!: string

    /** The size of the file in bytes, as the browser reports it: a file over the limit of one document is refused before it is sent. */
    @Field(() => Int, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsInt()
    @Min(0)
    sizeBytes?: number

    /** The area the file goes into, `public` or `internal`: a file too large for what that area has left is refused before it is sent. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsIn(["public", "internal"])
    @MaxLength(40)
    visibility?: string
}
