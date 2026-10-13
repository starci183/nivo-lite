import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Work returned by GraphQL. */
export class AccountingBookWorkType {
    /** id. */
    @Field(() => String)
    id!: string

    /** action. */
    @Field(() => String)
    action!: string

    /** status. */
    @Field(() => String)
    status!: string

    /** subject Type. */
    @Field(() => String)
    subjectType!: string

    /** subject Id. */
    @Field(() => String, { nullable: true })
    subjectId!: string | null

    /** created At. */
    @Field(() => String)
    createdAt!: string
}
