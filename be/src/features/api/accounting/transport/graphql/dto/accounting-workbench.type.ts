import { Field, ObjectType, Int } from "@nestjs/graphql"
import { AccountingPeriodsType } from "./accounting-periods.type"
import { AccountingAgeingType } from "./accounting-ageing.type"
import { AccountingWaitingType } from "./accounting-waiting.type"
import { AccountingCreditType } from "./accounting-credit.type"
import { AccountingInvoiceType } from "./accounting-invoice.type"
import { AccountingOrderType } from "./accounting-order.type"
import { AccountingQuestionType } from "./accounting-question.type"
import { AccountingUpcomingDueType } from "./accounting-upcoming-due.type"
import { AccountingStaffType } from "./accounting-staff.type"
import { AccountingLedgerEntryType } from "./accounting-ledger-entry.type"

@ObjectType()
/** Accounting Workbench returned by GraphQL. */
export class AccountingWorkbenchType {
    /** now. */
    @Field(() => String)
    now!: string

    /** periods. */
    @Field(() => AccountingPeriodsType)
    periods!: AccountingPeriodsType

    /** ageing. */
    @Field(() => AccountingAgeingType)
    ageing!: AccountingAgeingType

    /** waiting. */
    @Field(() => AccountingWaitingType)
    waiting!: AccountingWaitingType

    /** credits. */
    @Field(() => [AccountingCreditType])
    credits!: ReadonlyArray<AccountingCreditType>

    /** The display name of the connector that feeds payment credits, or null when none is connected. */
    @Field(() => String, { nullable: true })
    creditsSource!: string | null

    /** The display name of the connector that feeds supplier invoices, or null when none is connected. */
    @Field(() => String, { nullable: true })
    payablesSource!: string | null

    /** The tax deadlines and open supplier invoices falling due soon; null when the Brain has no tax profile. */
    @Field(() => [AccountingUpcomingDueType], { nullable: true })
    upcoming!: ReadonlyArray<AccountingUpcomingDueType> | null

    /** The days before a due date from which it counts as near; null when the Brain has no tax profile. */
    @Field(() => Int, { nullable: true })
    reminderDays!: number | null

    /** invoices. */
    @Field(() => [AccountingInvoiceType])
    invoices!: ReadonlyArray<AccountingInvoiceType>

    /** orders Without Invoice. */
    @Field(() => [AccountingOrderType])
    ordersWithoutInvoice!: ReadonlyArray<AccountingOrderType>

    /** questions. */
    @Field(() => [AccountingQuestionType])
    questions!: ReadonlyArray<AccountingQuestionType>

    /** staff. */
    @Field(() => [AccountingStaffType])
    staff!: ReadonlyArray<AccountingStaffType>

    /** owner Name. */
    @Field(() => String)
    ownerName!: string

    /** ledger. */
    @Field(() => [AccountingLedgerEntryType])
    ledger!: ReadonlyArray<AccountingLedgerEntryType>

    /** can Adjust. */
    @Field(() => Boolean)
    canAdjust!: boolean

    /** adjustments Ready. */
    @Field(() => Boolean)
    adjustmentsReady!: boolean

    /** excluded Test. */
    @Field(() => Int)
    excludedTest!: number
}
