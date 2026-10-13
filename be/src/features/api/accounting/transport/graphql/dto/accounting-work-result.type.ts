import { Field, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Accounting Work Result returned by GraphQL. */
export class AccountingWorkResultType {
    /** summary. */
    @Field(() => String)
    summary!: string

    /** href. */
    @Field(() => String, { nullable: true })
    href!: string | null
}
