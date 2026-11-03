import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { INSTAGRAM_FIELDS, PAGE_FIELDS } from "@modules/integrations/meta"
import type { AppObject, MetaPageChoice, MetaSubscriptionStatus } from "@modules/integrations/meta"

export const ID = "12345678-1234-1234-1234-123456789abc"
export const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
/** Build a pending Meta connection with optional overrides. */
export const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
    id: ID,
    workspaceId: "ws-1",
    provider: "meta",
    name: "Shop",
    meta: {},
    status: "pending",
    lastError: null,
    environment: "live",
    isDefault: false,
    lastEventAt: null,
    firstEvent: null,
    createdBy: "owner-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
})
export const PAGE: MetaPageChoice = {
    id: "page-1",
    name: "Shop Page",
    category: "Shopping",
    token: "page-token",
    ig: { id: "ig-1", username: "shop_ig", name: "Shop IG" },
}
export const pageSecret = { pageId: "page-1", pageToken: "page-token" }
type SealResultShape = {
    plain: string
    webhookSecret: string
}

/** Encode a test credential with its webhook verification secret. */
export const seal = (value: object): SealResultShape => ({
    plain: JSON.stringify(value),
    webhookSecret: "fixture-webhook-secret",
})
export const state = { w: "ws-1", u: "owner-1", r: `/connections?connect=meta&id=${ID}`, e: 1_800_000_000_000 }
export const callback = { state: "signed-state", code: "code-1", error: undefined }
/** Build the expected OAuth browser redirect location. */
export const location = (outcome: string, id: string | null = ID) => {
    const idQuery = id === null ? "" : `&id=${id}`
    return { location: `https://nivo.vn/connections?connect=meta&meta=${outcome}${idQuery}` }
}
type EmptyViewShape = {
    id: string
    name: string
    status: string
    configured: boolean
    pages: Array<never>
    pageId: string
    pageName: string
    igId: string
    igUsername: string
    firstEvent: null
    agentIds: Array<string>
}

export const emptyView: EmptyViewShape = {
    id: ID,
    name: "Shop",
    status: "pending",
    configured: true,
    pages: [],
    pageId: "",
    pageName: "",
    igId: "",
    igUsername: "",
    firstEvent: null,
    agentIds: ["agent-1"],
}
const appObject = (fields: ReadonlyArray<string>, overrides: Partial<AppObject> = {}): AppObject => ({
    callbackUrl: "https://nivo.vn/api/connections/meta/webhook",
    fields,
    missing: [],
    urlMatches: true,
    ...overrides,
})
type SubscribedShape = {
    subscribed: boolean
    fields: ReadonlyArray<string>
    missing: Array<never>
}

export const subscribed: SubscribedShape = { subscribed: true, fields: PAGE_FIELDS, missing: [] }
type GoodAppShape = {
    page: AppObject
    instagram: AppObject
}

export const goodApp: GoodAppShape = { page: appObject(PAGE_FIELDS), instagram: appObject(INSTAGRAM_FIELDS) }
type CheckBaseShape = {
    pageId: string
    pageName: string
    igUsername: string
    wantPage: ReadonlyArray<string>
    wantInstagram: ReadonlyArray<string>
    webhookUrl: string
    redirectUri: string
    localOnly: boolean
    verifyTokenSet: boolean
}

export const checkBase: CheckBaseShape = {
    pageId: "page-1",
    pageName: "",
    igUsername: "",
    wantPage: PAGE_FIELDS,
    wantInstagram: INSTAGRAM_FIELDS,
    webhookUrl: "https://nivo.vn/api/connections/meta/webhook",
    redirectUri: "https://nivo.vn/api/connections/meta/callback",
    localOnly: false,
    verifyTokenSet: true,
}

type GoodCheckShape = {
    ok: boolean
    tokenOk: boolean
    page: SubscribedShape
    appPage: AppObject
    appInstagram: AppObject
    appKnown: boolean
    repaired: boolean
    pageId: string
    pageName: string
    igUsername: string
    wantPage: ReadonlyArray<string>
    wantInstagram: ReadonlyArray<string>
    webhookUrl: string
    redirectUri: string
    localOnly: boolean
    verifyTokenSet: boolean
}

export const goodCheck: GoodCheckShape = {
    ...checkBase,
    ok: true,
    tokenOk: true,
    page: subscribed,
    appPage: goodApp.page,
    appInstagram: goodApp.instagram,
    appKnown: true,
    repaired: false,
}
export const checks: ReadonlyArray<
    readonly [string, string | undefined, MetaSubscriptionStatus["page"], MetaSubscriptionStatus["app"], boolean]
> = [
    ["no linked Instagram", undefined, subscribed, { page: goodApp.page, instagram: null }, true],
    ["unknown app subscriptions", "ig-1", subscribed, null, true],
    ["missing app Page object", "ig-1", subscribed, { page: null, instagram: goodApp.instagram }, false],
    [
        "wrong app Page URL",
        undefined,
        subscribed,
        { ...goodApp, page: appObject(PAGE_FIELDS, { urlMatches: false }) },
        false,
    ],
    [
        "missing app Page fields",
        undefined,
        subscribed,
        { ...goodApp, page: appObject(PAGE_FIELDS, { missing: ["feed"] }) },
        false,
    ],
    ["missing app Instagram object", "ig-1", subscribed, { page: goodApp.page, instagram: null }, false],
    [
        "wrong app Instagram URL",
        "ig-1",
        subscribed,
        { ...goodApp, instagram: appObject(INSTAGRAM_FIELDS, { urlMatches: false }) },
        false,
    ],
    [
        "missing app Instagram fields",
        "ig-1",
        subscribed,
        { ...goodApp, instagram: appObject(INSTAGRAM_FIELDS, { missing: ["comments"] }) },
        false,
    ],
    ["all Page and Instagram subscriptions", "ig-1", subscribed, goodApp, true],
    ["unsubscribed Page", undefined, { ...subscribed, subscribed: false }, goodApp, false],
    ["missing Page fields", undefined, { ...subscribed, missing: ["leadgen"] }, goodApp, false],
]
