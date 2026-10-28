import { Field, Float, ID, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One delivery to the webhook door of a SePay connection. */
export class SepayWebhookEventType {
    /** The row id. */
    @Field(() => ID)
    id!: string

    /** When it arrived, ISO 8601. */
    @Field(() => String)
    at!: string

    /** `accepted`, `duplicate` or `unauthorized`. */
    @Field(() => String)
    outcome!: string

    /** `credit`, `debit` or `ping`. */
    @Field(() => String)
    kind!: string

    /** The moved amount in VND, or null when none. */
    @Field(() => Float, { nullable: true })
    amountVnd!: number | null

    /** The SePay transaction id, or null. */
    @Field(() => String, { nullable: true })
    providerEventId!: string | null

    /** `test` or `live`, as the connection ran when it arrived. */
    @Field(() => String)
    environment!: string
}
