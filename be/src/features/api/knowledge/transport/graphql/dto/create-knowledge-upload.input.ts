import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

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
}
