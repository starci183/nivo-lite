import { Field, ObjectType, Float } from "@nestjs/graphql"

@ObjectType()
/** A bank transfer that needs review. */
export class BillingReviewTransactionType {
    /** The provider transaction id. */
    @Field(() => Float)
    id!: number

    /** The settlement status. */
    @Field(() => String)
    status!: string

    /** The amount transferred. */
    @Field(() => Float)
    transferAmount!: number

    /** When it was received, ISO 8601. */
    @Field(() => String)
    receivedAt!: string

    /** The transfer content. */
    @Field(() => String, { nullable: true })
    content!: string | null
}
