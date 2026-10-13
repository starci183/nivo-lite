import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Split returned by GraphQL. */
export class AccountingSplitType {
    /** live. */
    @Field(() => Float)
    live!: number

    /** simulated. */
    @Field(() => Float)
    simulated!: number
}
