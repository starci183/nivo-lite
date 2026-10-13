import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Week returned by GraphQL. */
export class AccountingWeekType {
    /** start Iso. */
    @Field(() => String)
    startIso!: string

    /** live. */
    @Field(() => Float)
    live!: number

    /** simulated. */
    @Field(() => Float)
    simulated!: number
}
