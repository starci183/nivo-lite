import { Field, ObjectType, Float, Int } from "@nestjs/graphql"
import { AccountingSplitType } from "./accounting-split.type"

@ObjectType()
/** Accounting Waiting returned by GraphQL. */
export class AccountingWaitingType {
    /** count. */
    @Field(() => AccountingSplitType)
    count!: AccountingSplitType

    /** known Vnd. */
    @Field(() => Float)
    knownVnd!: number

    /** unknown Amount. */
    @Field(() => Int)
    unknownAmount!: number
}
