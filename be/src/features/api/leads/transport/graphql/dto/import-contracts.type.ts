import { Field, Int, ObjectType } from "@nestjs/graphql"
import { ContractImportSkipType } from "./contract-import-skip.type"

@ObjectType()
/** What importing a contract sheet answers. */
export class ImportContractsType {
    /** How many contracts were saved. */
    @Field(() => Int)
    created!: number

    /** The rows left out, each with its reason. */
    @Field(() => [ContractImportSkipType])
    skipped!: ReadonlyArray<ContractImportSkipType>
}
