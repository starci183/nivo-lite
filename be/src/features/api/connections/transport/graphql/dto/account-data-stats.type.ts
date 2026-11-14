import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** What an account keeps of one declared type of its provider data: a count of its own rows, never a provider call. */
export class AccountDataTypeStatsType {
    /** The declared type (`telegram.message`, `imap.mail`). */
    @Field(() => String)
    type!: string

    /** The purpose tag the type declares (`chat.message`); null when it declares none. */
    @Field(() => String, { nullable: true })
    purpose!: string | null

    /** How many rows of the type the account keeps. */
    @Field(() => Int)
    rows!: number

    /** When the newest row of the type happened; null when the account keeps none. */
    @Field(() => Date, { nullable: true })
    newestAt!: Date | null
}

@ObjectType()
/** What an account's page shows of its stored provider data: per declared type, its rows and its newest one. */
export class AccountDataStatsType {
    /** One entry per declared type the account keeps rows of. */
    @Field(() => [AccountDataTypeStatsType])
    types!: Array<AccountDataTypeStatsType>
}
