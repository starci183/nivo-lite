import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Decision returned by GraphQL. */
export class AccountingBookDecisionType {
    /** id. */
    @Field(() => String)
    id!: string

    /** work Item Id. */
    @Field(() => String, { nullable: true })
    workItemId!: string | null

    /** action. */
    @Field(() => String)
    action!: string

    /** decided By. */
    @Field(() => String)
    decidedBy!: string

    /** decider Kind. */
    @Field(() => String)
    deciderKind!: string

    /** outcome. */
    @Field(() => String)
    outcome!: string

    /** note. */
    @Field(() => String, { nullable: true })
    note!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string
}
