import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One row left out of a contract import. */
export class ContractImportSkipType {
    /** The row number in the sheet. */
    @Field(() => Int)
    row!: number

    /** The problem code, or the refusal code of the contracts capability. */
    @Field()
    reason!: string
}
