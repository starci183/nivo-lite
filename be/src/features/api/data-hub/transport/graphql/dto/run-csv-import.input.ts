import { Field, InputType, Int } from "@nestjs/graphql"
import { IsDefined, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator"
import { DataJsonScalar } from "./data-json.type"
import { PreviewCsvSourceInput } from "./preview-csv-source.input"

@InputType()
/** The bounded arguments of runCsvImport: the source of previewCsvSource plus the mapping, the name and the schedule. */
export class RunCsvImportInput extends PreviewCsvSourceInput {
    /** The chosen mapping {idColumn, titleColumn, dateColumn, kinds: {header: text|phone|email|number|date}}; "__none__" or null means no column. */
    @Field(() => DataJsonScalar)
    @IsDefined()
    mapping!: unknown

    /** The name of a new import (2 to 60 characters); ignored when connectionId is given. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string | null

    /** Minutes between two re-reads of a Google Sheets link: 60, 360 or 1440; null is manual. */
    @Field(() => Int, { nullable: true })
    @IsOptional()
    @IsInt()
    @Min(60)
    @Max(1440)
    schedule?: number | null
}
