import { Field, ObjectType } from "@nestjs/graphql"
import { MetaPageSubscriptionType } from "./meta-page-subscription.type"
import { MetaAppObjectType } from "./meta-app-object.type"

@ObjectType()
/** What asking Meta about a connection answers. */
export class MetaCheckType {
    /** Everything Meta needs to deliver is in place. */
    @Field(() => Boolean)
    ok!: boolean

    /** The Page token is accepted. */
    @Field(() => Boolean)
    tokenOk!: boolean

    /** The Page id. */
    @Field(() => String)
    pageId!: string

    /** The Page name. */
    @Field(() => String)
    pageName!: string

    /** The Instagram username. */
    @Field(() => String)
    igUsername!: string

    /** The Page subscription. */
    @Field(() => MetaPageSubscriptionType)
    pageSubscription!: MetaPageSubscriptionType

    /** The app-level webhook for the page object. */
    @Field(() => MetaAppObjectType, { nullable: true })
    appPage!: MetaAppObjectType | null

    /** The app-level webhook for the instagram object. */
    @Field(() => MetaAppObjectType, { nullable: true })
    appInstagram!: MetaAppObjectType | null

    /** Whether Meta told the app-level subscription at all. */
    @Field(() => Boolean)
    appKnown!: boolean

    /** The Page fields wanted. */
    @Field(() => [String])
    wantPage!: ReadonlyArray<string>

    /** The Instagram fields wanted. */
    @Field(() => [String])
    wantInstagram!: ReadonlyArray<string>

    /** The webhook address to register on the Meta app. */
    @Field(() => String)
    webhookUrl!: string

    /** The OAuth redirect to register on the Meta app. */
    @Field(() => String)
    redirectUri!: string

    /** The site is not public https. */
    @Field(() => Boolean)
    localOnly!: boolean

    /** The webhook verify token is set. */
    @Field(() => Boolean)
    verifyTokenSet!: boolean

    /** The subscriptions were made again before the check. */
    @Field(() => Boolean)
    repaired!: boolean
}
