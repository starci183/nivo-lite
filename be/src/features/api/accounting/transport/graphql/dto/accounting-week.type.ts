import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Week returned by GraphQL. */
export class AccountingWeekType {
    /** start Iso. */
    @Field(() => String)
    startIso!: string

    /** The paid income of the week, VND. */
    @Field(() => Float)
    vnd!: number
}
