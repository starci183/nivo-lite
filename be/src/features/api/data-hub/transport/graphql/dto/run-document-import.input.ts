import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { ArrayMaxSize, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { UploadedFileInput } from "./uploaded-file.input"

@InputType()
/** The bounded arguments of runDocumentImport. */
export class RunDocumentImportInput {
    /** An existing documents import to add to. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The name of a new import (2 to 60 characters); ignored when connectionId is given. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string | null

    /** The uploaded .docx .pdf .txt .md files, at most 20, each at most 10 MB. */
    @Field(() => [UploadedFileInput], { nullable: true })
    @IsOptional()
    @ArrayMaxSize(20)
    @ValidateNested({ each: true })
    @Type(() => UploadedFileInput)
    files?: Array<UploadedFileInput> | null

    /** A public Google Docs link. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(600)
    link?: string | null
}
