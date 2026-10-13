/** The subscription of one app object. */
export class AppObjectBody {
    /** The callback url Meta has. */
    callbackUrl!: string
    /** The fields subscribed. */
    fields!: string[]
    /** Wanted fields that are missing. */
    missing!: string[]
    /** Whether the callback url is ours. */
    urlMatches!: boolean
}

/** The Page subscription. */
export class PageSubscriptionBody {
    /** Whether the app is subscribed to the Page. */
    subscribed!: boolean
    /** The fields subscribed. */
    fields!: string[]
    /** Wanted fields that are missing. */
    missing!: string[]
}

/** The HTTP response of the CheckMeta operation. */
export class CheckMetaResponse {
    /** The ok. */
    ok!: boolean
    /** The tokenOk. */
    tokenOk!: boolean
    /** The pageId. */
    pageId!: string
    /** The pageName. */
    pageName!: string
    /** The igUsername. */
    igUsername!: string
    /** The page. */
    page!: PageSubscriptionBody
    /** The appPage. */
    appPage!: AppObjectBody | null
    /** The appInstagram. */
    appInstagram!: AppObjectBody | null
    /** The appKnown. */
    appKnown!: boolean
    /** The wantPage. */
    wantPage!: string[]
    /** The wantInstagram. */
    wantInstagram!: string[]
    /** The webhookUrl. */
    webhookUrl!: string
    /** The redirectUri. */
    redirectUri!: string
    /** The localOnly. */
    localOnly!: boolean
    /** The verifyTokenSet. */
    verifyTokenSet!: boolean
    /** The repaired. */
    repaired!: boolean
}
