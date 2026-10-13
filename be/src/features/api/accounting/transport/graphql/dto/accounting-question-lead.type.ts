import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Question Lead returned by GraphQL. */
export class AccountingQuestionLeadType {
    /** id. */
    @Field(() => String)
    id!: string

    /** contact Name. */
    @Field(() => String)
    contactName!: string

    /** company. */
    @Field(() => String)
    company!: string

    /** channel. */
    @Field(() => String)
    channel!: string
}
