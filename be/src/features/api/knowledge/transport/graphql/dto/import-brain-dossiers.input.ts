import { Field, InputType } from "@nestjs/graphql"
import { IsOptional, IsString, MaxLength } from "class-validator"
import { NullAsAbsent } from "@modules/platform/graphql"

/** The most base64 characters one checklist workbook may take: ten megabytes of bytes. */
export const BRAIN_DOSSIERS_FILE_BASE64_MAX = 14_000_000

@InputType()
/** A checklist workbook sent inside the request: its name and its bytes as base64 (the back end reads it). */
export class ImportBrainDossiersInput {
    /** The file name, with its .xlsx extension. */
    @Field(() => String)
    @IsString()
    @MaxLength(255)
    name!: string

    /** The bytes of the file as base64. */
    @Field(() => String)
    @IsString()
    @MaxLength(BRAIN_DOSSIERS_FILE_BASE64_MAX)
    contentBase64!: string

    /** The tab to read; the standard status tab when absent. */
    @Field(() => String, { nullable: true })
    @NullAsAbsent()
    @IsOptional()
    @IsString()
    @MaxLength(120)
    sheet?: string
}
