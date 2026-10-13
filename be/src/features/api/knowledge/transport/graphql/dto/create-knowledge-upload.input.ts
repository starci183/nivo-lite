import { Field, InputType } from "@nestjs/graphql"
import { IsString, MaxLength, MinLength } from "class-validator"

@InputType()
/** The name of the file to upload. */
export class CreateKnowledgeUploadInput {
    /** The file name. */
    @Field(() => String)
    @IsString()
    @MinLength(1)
    @MaxLength(200)
    filename!: string
}
