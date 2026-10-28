import { Field, ID, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** The health of the webhook door of one SePay connection. */
export class SepayHealthType {
    /** When the last delivery arrived, ISO 8601, or null when none ever did. */
    @Field(() => String, { nullable: true })
    lastWebhookAt!: string | null

    /** Deliveries in the last 24 hours whose API key was valid. */
    @Field(() => Int)
    validCount!: number

    /** Deliveries in the last 24 hours. */
    @Field(() => Int)
    totalCount!: number

    /** Repeated deliveries blocked in the last 24 hours. */
    @Field(() => Int)
    duplicateCount!: number
}

@ObjectType()
/** The page read model of one SePay connection; the API key and the full account number are never in it. */
export class SepayConnectionType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The name. */
    @Field(() => String)
    name!: string

    /** The status. */
    @Field(() => String)
    status!: string

    /** `test` or `live`. */
    @Field(() => String)
    environment!: string

    /** The last failure shown to the owner, or null. */
    @Field(() => String, { nullable: true })
    lastError!: string | null

    /** The short bank code. */
    @Field(() => String)
    bankCode!: string

    /** The human name of the bank. */
    @Field(() => String)
    bank!: string

    /** The masked account number. */
    @Field(() => String)
    accountMasked!: string

    /** True when NIVO stores the full account number a VietQR needs. */
    @Field(() => Boolean)
    hasFullAccount!: boolean

    /** The account holder. */
    @Field(() => String)
    holder!: string

    /** The address the owner pastes into SePay. */
    @Field(() => String)
    webhookUrl!: string

    /** The API key hidden but for its last 4 characters. */
    @Field(() => String)
    apiKeyMasked!: string

    /** When SePay's test ping was last seen, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    pingSeenAt!: string | null

    /** When a transaction last landed, ISO 8601, or null. */
    @Field(() => String, { nullable: true })
    transactionSeenAt!: string | null

    /** The health tiles. */
    @Field(() => SepayHealthType)
    health!: SepayHealthType

    /** The agents that use the connection. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>
}
