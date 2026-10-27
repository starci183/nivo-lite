import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ContractImportMappingType } from "./contract-import-mapping.type"
import { ContractImportRowType } from "./contract-import-row.type"

@ObjectType()
/** What reading a contract sheet answers before anything is saved. */
export class ContractImportPreviewType {
    /** The column names. */
    @Field(() => [String])
    headers!: ReadonlyArray<string>

    /** The workbook tab names (empty for other sources). */
    @Field(() => [String])
    sheets!: ReadonlyArray<string>

    /** The tab that was read. */
    @Field(() => String)
    sheet!: string

    /** The mapping the rows were judged with (suggested unless one was given). */
    @Field(() => ContractImportMappingType)
    mapping!: ContractImportMappingType

    /** The first 20 rows, judged. */
    @Field(() => [ContractImportRowType])
    rows!: ReadonlyArray<ContractImportRowType>

    /** How many data rows there are. */
    @Field(() => Int)
    total!: number

    /** How many rows would be saved. */
    @Field(() => Int)
    ready!: number
}
