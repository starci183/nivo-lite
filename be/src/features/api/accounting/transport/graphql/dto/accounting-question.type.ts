import { Field, ObjectType } from "@nestjs/graphql"
import { AccountingQuestionWorkType } from "./accounting-question-work.type"

@ObjectType()
/** Accounting Question returned by GraphQL. */
export class AccountingQuestionType {
    /** item. */
    @Field(() => AccountingQuestionWorkType)
    item!: AccountingQuestionWorkType

    /** group. */
    @Field(() => String)
    group!: string
}
