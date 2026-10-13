import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Book Lead returned by GraphQL. */
export class AccountingBookLeadType {
    /** contact Name. */
    @Field(() => String, { nullable: true })
    contactName!: string | null

    /** company. */
    @Field(() => String, { nullable: true })
    company!: string | null
}
