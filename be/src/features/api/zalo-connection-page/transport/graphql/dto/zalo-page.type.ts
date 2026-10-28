import { Field, ID, ObjectType } from "@nestjs/graphql"
import { ZaloCheckType } from "./zalo-check.type"
import { ZaloRecipientType } from "./zalo-recipient.type"
import { ZaloAccessType } from "./zalo-access.type"
import { ZnsRenewalType } from "./zns-renewal.type"

@ObjectType()
/** The page of one Zalo OA connection; every secret is masked to its last four characters. */
export class ZaloPageType {
    /** The connection id. */
    @Field(() => ID)
    id!: string

    /** The OA name. */
    @Field(() => String)
    name!: string

    /** The status of the connection. */
    @Field(() => String)
    status!: string

    /** The connection works and needs no attention. */
    @Field(() => Boolean)
    healthy!: boolean

    /** The Official Account id. */
    @Field(() => String)
    oaId!: string

    /** The Zalo app id. */
    @Field(() => String)
    appId!: string

    /** The app secret masked to its last four characters. */
    @Field(() => String, { nullable: true })
    appSecretMask!: string | null

    /** The OA Secret Key masked to its last four characters. */
    @Field(() => String, { nullable: true })
    oaSecretMask!: string | null

    /** The Official Account callback address to paste into Zalo. */
    @Field(() => String)
    callbackUrl!: string

    /** The webhook address to paste into Zalo. */
    @Field(() => String)
    webhookUrl!: string

    /** The access. */
    @Field(() => ZaloAccessType)
    access!: ZaloAccessType

    /** The rows of the check list. */
    @Field(() => [ZaloCheckType])
    checks!: ReadonlyArray<ZaloCheckType>

    /** The followers a test message can go to. */
    @Field(() => [ZaloRecipientType])
    recipients!: ReadonlyArray<ZaloRecipientType>

    /** Why the test send is closed, or null. */
    @Field(() => String, { nullable: true })
    sendBlock!: string | null

    /** The agents that use the connection. */
    @Field(() => [ID])
    agentIds!: ReadonlyArray<string>

    /** The ZNS renewal template used outside the 48-hour window, or null when none is configured. */
    @Field(() => ZnsRenewalType, { nullable: true })
    znsRenewal!: ZnsRenewalType | null
}
