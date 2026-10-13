import { Field, ID, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from "class-validator"
import { DataJsonScalar } from "./data-json.type"
import { UploadedFileInput } from "./uploaded-file.input"

/** The most characters pasted table text may take. */
export const CSV_TEXT_MAX = 10_485_760

@InputType()
/** The bounded arguments of previewCsvSource: which source to read (also the base of runCsvImport). */
export class PreviewCsvSourceInput {
    /** Where the rows come from: file, sheet (Google Sheets link), paste (text copied from Excel) or grid (typed rows). */
    @Field(() => String)
    @IsIn(["file", "sheet", "paste", "grid"])
    @MaxLength(10)
    kind!: string

    /** What the rows are about: customer, order, product, transaction or other (ignored when connectionId is given). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(30)
    entity?: string | null

    /** An existing import to upload into again. */
    @Field(() => ID, { nullable: true })
    @IsOptional()
    @IsUUID()
    @MaxLength(64)
    connectionId?: string | null

    /** The uploaded .csv or .xlsx (kind file). */
    @Field(() => UploadedFileInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => UploadedFileInput)
    file?: UploadedFileInput | null

    /** The workbook tab to read (kind file, .xlsx). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    sheet?: string | null

    /** The public Google Sheets link (kind sheet). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(600)
    link?: string | null

    /** The pasted table text (kind paste). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(CSV_TEXT_MAX)
    text?: string | null

    /** The typed grid as {headers: [String], rows: [[String]]} (kind grid). */
    @Field(() => DataJsonScalar, { nullable: true })
    @IsOptional()
    grid?: unknown
}
