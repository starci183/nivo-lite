import { Field, InputType } from "@nestjs/graphql"
import { Type } from "class-transformer"
import { IsOptional, IsString, MaxLength, ValidateNested } from "class-validator"
import { ContractImportFileInput } from "./contract-import-file.input"
import { ContractImportMappingInput } from "./contract-import-mapping.input"
import { CONTRACT_IMPORT_TEXT_MAX } from "./preview-contract-import.input"

@InputType()
/** The bounded arguments of importContracts: the file or the pasted text and the chosen mapping. */
export class ImportContractsInput {
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

    /** The chosen mapping. */
    @Field(() => ContractImportMappingInput)
    @ValidateNested()
    @Type(() => ContractImportMappingInput)
    mapping!: ContractImportMappingInput
}
