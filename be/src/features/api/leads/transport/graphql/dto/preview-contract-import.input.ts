import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { ContractImportFileInput } from "./contract-import-file.input"
import { ContractImportMappingInput } from "./contract-import-mapping.input"

/** The most characters pasted contract text may take. */
export const CONTRACT_IMPORT_TEXT_MAX = 10_485_760

@InputType()
/** The bounded arguments of previewContractImport: the file or the pasted text (also the base of importContracts). */
export class PreviewContractImportInput {
    /** The uploaded .csv or .xlsx; it wins over the text. */
    @Field(() => ContractImportFileInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => ContractImportFileInput)
    file?: ContractImportFileInput | null

    /** The workbook tab to read (.xlsx). */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    sheet?: string | null

    /** The pasted table text. */
    @Field(() => String, { nullable: true })
    @IsOptional()
    @IsString()
    @MaxLength(CONTRACT_IMPORT_TEXT_MAX)
    text?: string | null

    /** The chosen mapping; omitted suggests one from the headers. */
    @Field(() => ContractImportMappingInput, { nullable: true })
    @IsOptional()
    @ValidateNested()
    @Type(() => ContractImportMappingInput)
    mapping?: ContractImportMappingInput | null
}
