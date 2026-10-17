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
/** Encode a test credential with its webhook verification secret. */
export const seal = (value: object) => ({ plain: JSON.stringify(value), webhookSecret: "fixture-webhook-secret" })
export const state = { w: "ws-1", u: "owner-1", r: `/connections?connect=meta&id=${ID}`, e: 1_800_000_000_000 }
export const callback = { state: "signed-state", code: "code-1", error: undefined }
/** Build the expected OAuth browser redirect location. */
export const location = (outcome: string, id: string | null = ID) => ({
    location: `https://nivo.vn/connections?connect=meta&meta=${outcome}${id === null ? "" : `&id=${id}`}`,
})
export const emptyView = {
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
export const subscribed = { subscribed: true, fields: PAGE_FIELDS, missing: [] }
export const goodApp = { page: appObject(PAGE_FIELDS), instagram: appObject(INSTAGRAM_FIELDS) }
export const checkBase = {
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
export const goodCheck = {
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
