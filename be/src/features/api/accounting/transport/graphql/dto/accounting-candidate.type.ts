import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** Accounting Candidate returned by GraphQL. */
export class AccountingCandidateType {
    /** id. */
    @Field(() => String)
    id!: string

    /** label. */
    @Field(() => String)
    label!: string

    /** amount Vnd. */
    @Field(() => Float)
    amountVnd!: number
}
