import { Field, Float, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** Current-month use against the workspace allowance. */
export class CreditQuotaStatusType {
    /** First day of the Vietnam month, YYYY-MM-DD. */
    @Field()
    periodStart!: string

    /** Customer replies this month. */
    @Field(() => Float)
    messagesUsed!: number

    /** Model tokens this month. */
    @Field(() => Float)
    tokensUsed!: number

    /** Model cost in USD. */
    @Field(() => Float)
    costUsd!: number

    /** The message allowance; null is unlimited. */
    @Field(() => Float, { nullable: true })
    messagesLimit!: number | null

    /** The token allowance; null is unlimited. */
    @Field(() => Float, { nullable: true })
    tokensLimit!: number | null

    /** The workspace's reply when over allowance. */
    @Field(() => String, { nullable: true })
    fallbackReply!: string | null

    /** Credits spent this month. */
    @Field(() => Float)
    creditsUsed!: number

    /** Allowance including carryover; null is unlimited. */
    @Field(() => Float, { nullable: true })
    creditsLimit!: number | null

    /** Credits carried over from last month. */
    @Field(() => Float)
    creditsCarried!: number

    /** Top-up credits still spendable. */
    @Field(() => Float)
    topupBalance!: number

    /** Whether the message allowance is used up. */
    @Field()
    messagesExceeded!: boolean

    /** Whether the token allowance is used up. */
    @Field()
    tokensExceeded!: boolean

    /** Whether the allowance and top-ups are used up. */
    @Field()
    creditsExceeded!: boolean

    /** The greatest used-to-allowance ratio. */
    @Field(() => Float)
    ratio!: number

    /** The quota level: ok, warn or exceeded. */
    @Field()
    level!: string
}
