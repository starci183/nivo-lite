import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingBookInvoiceType } from "./accounting-book-invoice.type"
import { AccountingBookTransactionType } from "./accounting-book-transaction.type"
import { AccountingBookOrderType } from "./accounting-book-order.type"
import { AccountingBookWorkType } from "./accounting-book-work.type"
import { AccountingBookDecisionType } from "./accounting-book-decision.type"
import { AccountingBookAdjustmentType } from "./accounting-book-adjustment.type"

@ObjectType()
/** Accounting Book returned by GraphQL. */
export class AccountingBookType {
    /** invoices. */
    @Field(() => [AccountingBookInvoiceType])
    invoices!: ReadonlyArray<AccountingBookInvoiceType>

    /** transactions. */
    @Field(() => [AccountingBookTransactionType])
    transactions!: ReadonlyArray<AccountingBookTransactionType>

    /** orders. */
    @Field(() => [AccountingBookOrderType])
    orders!: ReadonlyArray<AccountingBookOrderType>

    /** works. */
    @Field(() => [AccountingBookWorkType])
    works!: ReadonlyArray<AccountingBookWorkType>

    /** decisions. */
    @Field(() => [AccountingBookDecisionType])
    decisions!: ReadonlyArray<AccountingBookDecisionType>

    /** adjustments. */
    @Field(() => [AccountingBookAdjustmentType])
    adjustments!: ReadonlyArray<AccountingBookAdjustmentType>

    /** adjustments Ready. */
    @Field(() => Boolean)
    adjustmentsReady!: boolean
}
