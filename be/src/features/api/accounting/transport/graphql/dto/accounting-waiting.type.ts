import { Field, ObjectType, Float, Int } from "@nestjs/graphql"

@ObjectType()
/** Accounting Waiting returned by GraphQL. */
export class AccountingWaitingType {
    /** The number of waiting items. */
    @Field(() => Int)
    count!: number

    /** known Vnd. */
    @Field(() => Float)
    knownVnd!: number

    /** unknown Amount. */
    @Field(() => Int)
    unknownAmount!: number
}
