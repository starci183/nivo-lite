import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { AccountingLineageType } from "./accounting-lineage.type"

@ObjectType()
/** Accounting Ledger Entry returned by GraphQL. */
export class AccountingLedgerEntryType {
    /** id. */
    @Field(() => String)
    id!: string

    /** target Type. */
    @Field(() => String)
    targetType!: string

    /** target Id. */
    @Field(() => String)
    targetId!: string

    /** at. */
    @Field(() => String)
    at!: string

    /** description. */
    @Field(() => String)
    description!: string

    /** kind. */
    @Field(() => String)
    kind!: string

    /** amount. */
    @Field(() => Float)
    amount!: number

    /** status. */
    @Field(() => String)
    status!: string

    /** linked. */
    @Field(() => String, { nullable: true })
    linked!: string | null

    /** lineage. */
    @Field(() => [AccountingLineageType])
    lineage!: ReadonlyArray<AccountingLineageType>

    /** adjustment Count. */
    @Field(() => Int)
    adjustmentCount!: number
}
