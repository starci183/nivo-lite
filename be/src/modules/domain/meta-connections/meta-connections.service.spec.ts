import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { ConnectionsError, ConnectionsErrorCode, ConnectionsService } from "@modules/domain/connections"
import type { ConnectionActor, ConnectionRecord } from "@modules/domain/connections"
import { INSTAGRAM_FIELDS, META_CLIENT, MetaError, MetaErrorCode, PAGE_FIELDS } from "@modules/integrations/meta"
import type { AppObject, MetaClient, MetaPageChoice, MetaSubscriptionStatus } from "@modules/integrations/meta"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { MetaConnectionsErrorCode } from "./errors/meta-connections.error"
import { MetaConnectionsService } from "./meta-connections.service"

const ID = "12345678-1234-1234-1234-123456789abc"
const actor: ConnectionActor = { principalId: "owner-1", workspaceId: "ws-1" }
const record = (overrides: Partial<ConnectionRecord> = {}): ConnectionRecord => ({
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
const PAGE: MetaPageChoice = {
    id: "page-1",
    name: "Shop Page",
    category: "Shopping",
    token: "page-token",
    ig: { id: "ig-1", username: "shop_ig", name: "Shop IG" },
}
const pageSecret = { pageId: "page-1", pageToken: "page-token" }
const seal = (value: object) => ({ plain: JSON.stringify(value), webhookSecret: "webhook-secret" })
const state = { w: "ws-1", u: "owner-1", r: `/connections?connect=meta&id=${ID}`, e: 1_800_000_000_000 }
const callback = { state: "signed-state", code: "code-1", error: undefined }
const location = (outcome: string, id: string | null = ID) => ({
    location: `https://nivo.vn/connections?connect=meta&meta=${outcome}${id === null ? "" : `&id=${id}`}`,
})
const emptyView = {
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
const subscribed = { subscribed: true, fields: PAGE_FIELDS, missing: [] }
const goodApp = { page: appObject(PAGE_FIELDS), instagram: appObject(INSTAGRAM_FIELDS) }
const checkBase = {
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
const goodCheck = {
    ...checkBase,
    ok: true,
    tokenOk: true,
    page: subscribed,
    appPage: goodApp.page,
    appInstagram: goodApp.instagram,
    appKnown: true,
    repaired: false,
}

const build = async () => {
    const connections = mock<ConnectionsService>()
    connections.authorize.mockResolvedValue({ role: "owner", displayName: "Lan" })
    connections.get.mockResolvedValue(record())
    connections.agentIds.mockResolvedValue(["agent-1"])
    connections.find.mockResolvedValue(record())
    connections.create.mockResolvedValue(ID)
    connections.readSecret.mockResolvedValue(seal({}))
    connections.findLiveByMeta.mockResolvedValue(null)
    connections.publicOrigin.mockReturnValue("https://nivo.vn")
    connections.siteBase.mockReturnValue("https://nivo.vn")
    const meta = mock<MetaClient>()
    meta.isConfigured.mockReturnValue(true)
    meta.sign.mockReturnValue("signed-state")
    meta.authUrl.mockReturnValue("https://meta.test/auth")
    meta.verify.mockReturnValue(state)
    meta.exchangeCode.mockResolvedValue("user-token")
    meta.listPages.mockResolvedValue([PAGE])
    meta.subscribePage.mockResolvedValue(undefined)
    meta.unsubscribePage.mockResolvedValue(undefined)
    meta.ensureAppSubscriptions.mockResolvedValue({ done: true })
    meta.subscriptionStatus.mockResolvedValue({ page: subscribed, app: goodApp })
    meta.webhookUrl.mockReturnValue(checkBase.webhookUrl)
    meta.redirectUri.mockReturnValue(checkBase.redirectUri)
    meta.hasVerifyToken.mockReturnValue(true)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            MetaConnectionsService,
            { provide: ConnectionsService, useValue: connections },
            { provide: META_CLIENT, useValue: meta },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: moduleRef.get(MetaConnectionsService), connections, meta, logger }
}

describe("MetaConnectionsService", () => {
    describe("authorize and resume", () => {
        it("creates a pending connection and signs its return path for the owner", async () => {
            const { service, connections, meta } = await build()

            await expect(service.authorize(actor, undefined)).resolves.toEqual({
                connectionId: ID,
                url: "https://meta.test/auth",
            })

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(connections.create).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                createdBy: "owner-1",
                provider: "meta",
                name: "Facebook & Instagram",
                status: "pending",
                environment: "live",
                meta: {},
                secret: { plain: "{}", webhookSecret: expect.stringMatching(/^[0-9a-f]{64}$/u) },
            })
            expect(meta.sign).toHaveBeenCalledWith({
                workspaceId: "ws-1",
                userId: "owner-1",
                returnTo: `/connections?connect=meta&id=${ID}`,
            })
            expect(meta.authUrl).toHaveBeenCalledWith("signed-state")
        })

        it("authorizes the existing Meta connection without creating another", async () => {
            const { service, connections } = await build()

            await expect(service.authorize(actor, ID)).resolves.toEqual({
                connectionId: ID,
                url: "https://meta.test/auth",
            })

            expect(connections.get).toHaveBeenCalledWith("ws-1", ID)
            expect(connections.create).not.toHaveBeenCalled()
        })

        it("refuses missing configuration and a missing authorization URL", async () => {
            const { service, connections, meta } = await build()
            meta.isConfigured.mockReturnValueOnce(false)

            await expect(service.authorize(actor, undefined)).rejects.toMatchObject({
                code: MetaConnectionsErrorCode.NotConfigured,
            })
            expect(connections.create).not.toHaveBeenCalled()
            meta.authUrl.mockReturnValueOnce(null)
            await expect(service.authorize(actor, ID)).rejects.toMatchObject({
                code: MetaConnectionsErrorCode.NotConfigured,
            })
        })

        it("refuses a connection of another provider", async () => {
            const { service, connections } = await build()
            connections.get.mockResolvedValue(record({ provider: "google" }))

            await expect(service.authorize(actor, ID)).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: ID },
            })
            await expect(service.resume(actor, ID)).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: ID },
            })
        })

        it("resumes an empty credential, exposing no tokens", async () => {
            const { service, connections } = await build()
            connections.readSecret.mockResolvedValue(null)

            await expect(service.resume(actor, ID)).resolves.toEqual(emptyView)

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(connections.readSecret).toHaveBeenCalledWith(ID)
        })

        it("resumes the selected Page and all choice metadata with blank optional fields", async () => {
            const { service, connections, meta } = await build()
            const firstEvent = { at: "2026-10-12T03:00:00.000Z", amount: 0, content: "First message" }
            connections.get.mockResolvedValue(
                record({
                    status: "connected",
                    meta: { page_id: "page-1", page_name: "Shop Page", ig_id: "ig-1", ig_username: "shop_ig" },
                    firstEvent,
                }),
            )
            connections.readSecret.mockResolvedValue(
                seal({
                    pages: [
                        PAGE,
                        { ...PAGE, id: "page-2", category: null, ig: null },
                        { ...PAGE, id: "page-3", ig: { id: "ig-3", username: null, name: null } },
                    ],
                }),
            )
            meta.isConfigured.mockReturnValue(false)

            await expect(service.resume(actor, ID)).resolves.toEqual({
                ...emptyView,
                status: "connected",
                configured: false,
                pages: [
                    { id: "page-1", name: "Shop Page", category: "Shopping", igId: "ig-1", igUsername: "shop_ig" },
                    { id: "page-2", name: "Shop Page", category: "", igId: "", igUsername: "" },
                    { id: "page-3", name: "Shop Page", category: "Shopping", igId: "ig-3", igUsername: "" },
                ],
                pageId: "page-1",
                pageName: "Shop Page",
                igId: "ig-1",
                igUsername: "shop_ig",
                firstEvent,
                agentIds: ["agent-1"],
            })
        })
    })

    describe("choosePage", () => {
        it("subscribes a Page, replaces the choices with its token and records full metadata", async () => {
            const { service, connections, meta } = await build()
            const choice = { ...PAGE, name: "x".repeat(70) }
            const selected = record({
                name: "x".repeat(60),
                status: "connected",
                meta: {
                    page_id: "page-1",
                    page_name: choice.name,
                    category: "Shopping",
                    ig_id: "ig-1",
                    ig_username: "shop_ig",
                },
            })
            connections.get.mockResolvedValueOnce(record()).mockResolvedValueOnce(selected)
            connections.readSecret
                .mockResolvedValueOnce(seal({ pages: [choice] }))
                .mockResolvedValueOnce(seal(pageSecret))
            connections.findLiveByMeta.mockResolvedValue(record())
            meta.ensureAppSubscriptions.mockRejectedValue(new Error("app token is unavailable"))

            await expect(service.choosePage(actor, ID, "page-1")).resolves.toEqual({
                ...emptyView,
                name: "x".repeat(60),
                status: "connected",
                pageId: "page-1",
                pageName: choice.name,
                igId: "ig-1",
                igUsername: "shop_ig",
            })

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner"])
            expect(connections.findLiveByMeta.mock.calls).toEqual([
                ["meta", "page_id", "page-1"],
                ["meta", "ig_id", "ig-1"],
            ])
            expect(meta.subscribePage).toHaveBeenCalledWith("page-1", "page-token")
            expect(meta.ensureAppSubscriptions).toHaveBeenCalledTimes(1)
            expect(connections.writeSecret).toHaveBeenCalledWith(ID, JSON.stringify(pageSecret))
            expect(connections.patch).toHaveBeenCalledWith("ws-1", ID, {
                name: "x".repeat(60),
                status: "connected",
                lastError: null,
                meta: selected.meta,
            })
        })

        it.each([
            {
                label: "no Instagram",
                choice: { ...PAGE, category: null, ig: null },
                metadata: { page_id: "page-1", page_name: "Shop Page" },
            },
            {
                label: "a blank Instagram username",
                choice: { ...PAGE, category: "", ig: { id: "ig-1", username: null, name: null } },
                metadata: { page_id: "page-1", page_name: "Shop Page", ig_id: "ig-1", ig_username: "" },
            },
        ])("chooses a Page with $label", async ({ choice, metadata }) => {
            const { service, connections } = await build()
            connections.readSecret
                .mockResolvedValueOnce(seal({ pages: [choice] }))
                .mockResolvedValueOnce(seal(pageSecret))

            await expect(service.choosePage(actor, ID, "page-1")).resolves.toEqual(emptyView)

            expect(connections.patch).toHaveBeenCalledWith("ws-1", ID, {
                name: "Shop Page",
                status: "connected",
                lastError: null,
                meta: metadata,
            })
        })

        it.each([{}, { pages: [] }, { pages: [PAGE] }])(
            "refuses a Page absent from the sealed choices %j",
            async (secret) => {
                const { service, connections, meta } = await build()
                connections.readSecret.mockResolvedValue(seal(secret))

                await expect(service.choosePage(actor, ID, "missing-page")).rejects.toMatchObject({
                    code: MetaConnectionsErrorCode.PageGone,
                })

                expect(meta.subscribePage).not.toHaveBeenCalled()
            },
        )

        it.each(["page", "instagram"])("refuses a %s already used by another live connection", async (taken) => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal({ pages: [PAGE] }))
            if (taken === "page") connections.findLiveByMeta.mockResolvedValueOnce(record({ id: "other-id" }))
            else
                connections.findLiveByMeta.mockResolvedValueOnce(null).mockResolvedValueOnce(record({ id: "other-id" }))

            await expect(service.choosePage(actor, ID, "page-1")).rejects.toMatchObject({
                code: MetaConnectionsErrorCode.PageInUse,
            })

            expect(meta.subscribePage).not.toHaveBeenCalled()
            expect(connections.writeSecret).not.toHaveBeenCalled()
        })

        it.each([
            { code: MetaErrorCode.NotConfigured, failure: undefined, expected: MetaConnectionsErrorCode.NotConfigured },
            { code: MetaErrorCode.Unreachable, failure: undefined, expected: MetaConnectionsErrorCode.Network },
            { code: MetaErrorCode.Refused, failure: "token", expected: MetaConnectionsErrorCode.TokenRefused },
            {
                code: MetaErrorCode.Refused,
                failure: "permission",
                expected: MetaConnectionsErrorCode.PermissionRefused,
            },
            { code: MetaErrorCode.Refused, failure: "rate_limited", expected: MetaConnectionsErrorCode.RateLimited },
            { code: MetaErrorCode.Refused, failure: "not_found", expected: MetaConnectionsErrorCode.Failed },
            { code: MetaErrorCode.ContractMismatch, failure: undefined, expected: MetaConnectionsErrorCode.Failed },
        ])("maps $code / $failure to $expected", async ({ code, failure, expected }) => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal({ pages: [PAGE] }))
            const error = new MetaError({ code, params: failure === undefined ? {} : { failure } })
            meta.subscribePage.mockRejectedValue(error)

            await expect(service.choosePage(actor, ID, "page-1")).rejects.toMatchObject({
                code: expected,
                cause: error,
            })

            expect(connections.writeSecret).not.toHaveBeenCalled()
        })

        it("preserves an unexpected error from Meta", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal({ pages: [PAGE] }))
            const error = new Error("unexpected subscription failure")
            meta.subscribePage.mockRejectedValue(error)

            await expect(service.choosePage(actor, ID, "page-1")).rejects.toBe(error)
        })
    })

    describe("check", () => {
        it("repairs Page and app subscriptions and heals an errored connection", async () => {
            const { service, connections, meta } = await build()
            connections.get.mockResolvedValue(
                record({ status: "error", meta: { ig_id: "ig-1", page_name: "Shop Page", ig_username: "shop_ig" } }),
            )
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            meta.ensureAppSubscriptions.mockRejectedValue(new Error("app token unavailable"))

            await expect(service.check(actor, ID, true)).resolves.toEqual({
                ...goodCheck,
                pageName: "Shop Page",
                igUsername: "shop_ig",
                repaired: true,
            })

            expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
            expect(meta.subscribePage).toHaveBeenCalledWith("page-1", "page-token")
            expect(meta.ensureAppSubscriptions).toHaveBeenCalledTimes(1)
            expect(meta.subscriptionStatus).toHaveBeenCalledWith(pageSecret)
            expect(connections.patch).toHaveBeenCalledWith("ws-1", ID, { status: "connected", lastError: null })
        })

        const checks: ReadonlyArray<
            readonly [
                string,
                string | undefined,
                MetaSubscriptionStatus["page"],
                MetaSubscriptionStatus["app"],
                boolean,
            ]
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
        it.each(checks)("reports %s exactly", async (_label, igId, page, app, ok) => {
            const { service, connections, meta } = await build()
            connections.get.mockResolvedValue(record({ meta: igId === undefined ? {} : { ig_id: igId } }))
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            meta.subscriptionStatus.mockResolvedValue({ page, app })

            await expect(service.check(actor, ID, false)).resolves.toEqual({
                ...goodCheck,
                ok,
                page,
                appPage: app?.page ?? null,
                appInstagram: app?.instagram ?? null,
                appKnown: app !== null,
            })

            expect(meta.subscribePage).not.toHaveBeenCalled()
            expect(meta.ensureAppSubscriptions).not.toHaveBeenCalled()
            expect(connections.patch).not.toHaveBeenCalled()
        })

        it("shows blank deployment URLs and a local site when the configuration is absent", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            connections.publicOrigin.mockReturnValue(null)
            meta.webhookUrl.mockReturnValue(null)
            meta.redirectUri.mockReturnValue(null)
            meta.hasVerifyToken.mockReturnValue(false)
            meta.subscriptionStatus.mockResolvedValue({ page: subscribed, app: null })

            await expect(service.check(actor, ID, false)).resolves.toEqual({
                ...goodCheck,
                webhookUrl: "",
                redirectUri: "",
                localOnly: true,
                verifyTokenSet: false,
                appPage: null,
                appInstagram: null,
                appKnown: false,
            })
        })

        it("refuses a disconnected connection", async () => {
            const { service, connections } = await build()
            connections.get.mockResolvedValue(record({ status: "disconnected" }))

            await expect(service.check(actor, ID, false)).rejects.toMatchObject({
                code: ConnectionsErrorCode.NotFound,
                params: { id: ID },
            })

            expect(connections.readSecret).not.toHaveBeenCalled()
        })

        it.each([{}, { pageId: "page-1" }, { pageToken: "page-token" }])(
            "refuses a credential without Page access %j",
            async (secret) => {
                const { service, connections, meta } = await build()
                connections.readSecret.mockResolvedValue(seal(secret))

                await expect(service.check(actor, ID, false)).rejects.toMatchObject({
                    code: MetaConnectionsErrorCode.NoPage,
                })

                expect(meta.subscriptionStatus).not.toHaveBeenCalled()
            },
        )

        it.each([false, true])("records a token refusal while repair is %s", async (repair) => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            const error = new MetaError({ code: MetaErrorCode.Refused, params: { failure: "token" } })
            if (repair) meta.subscribePage.mockRejectedValue(error)
            else meta.subscriptionStatus.mockRejectedValue(error)

            await expect(service.check(actor, ID, repair)).resolves.toEqual({
                ...goodCheck,
                ok: false,
                tokenOk: false,
                page: { subscribed: false, fields: [], missing: PAGE_FIELDS },
                appPage: null,
                appInstagram: null,
                appKnown: false,
                repaired: repair,
            })

            expect(connections.patch).toHaveBeenCalledWith("ws-1", ID, {
                status: "error",
                lastError: MetaConnectionsErrorCode.TokenRefused,
            })
        })

        it("maps non-token Meta errors from the check", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            const error = new MetaError({ code: MetaErrorCode.Refused, params: { failure: "permission" } })
            meta.subscriptionStatus.mockRejectedValue(error)

            await expect(service.check(actor, ID, false)).rejects.toMatchObject({
                code: MetaConnectionsErrorCode.PermissionRefused,
                cause: error,
            })

            expect(connections.patch).not.toHaveBeenCalled()
        })

        it("preserves an unexpected check failure", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            const error = new Error("unexpected status failure")
            meta.subscriptionStatus.mockRejectedValue(error)

            await expect(service.check(actor, ID, false)).rejects.toBe(error)
        })
    })

    describe("complete", () => {
        it("redirects an invalid or expired state without a connection id", async () => {
            const { service, connections, meta } = await build()
            meta.verify.mockReturnValueOnce(null).mockImplementationOnce(() => {
                throw new MetaError({ code: MetaErrorCode.NotConfigured })
            })

            await expect(service.complete({ ...callback, state: undefined })).resolves.toEqual(
                location("expired", null),
            )
            await expect(service.complete(callback)).resolves.toEqual(location("expired", null))

            expect(meta.verify.mock.calls).toEqual([[undefined], ["signed-state"]])
            expect(connections.authorize).not.toHaveBeenCalled()
        })

        it("redirects a verified state with an invalid return connection id", async () => {
            const { service, meta } = await build()
            meta.verify.mockReturnValue({ ...state, r: "/connections?id=invalid" })

            await expect(service.complete(callback)).resolves.toEqual(location("failed", null))
        })

        it("redirects an unavailable Meta app", async () => {
            const { service, connections, meta } = await build()
            meta.isConfigured.mockReturnValue(false)

            await expect(service.complete(callback)).resolves.toEqual(location("unavailable"))

            expect(connections.authorize).not.toHaveBeenCalled()
        })

        it.each([null, record({ provider: "google" }), record({ status: "disconnected" })])(
            "denies a missing, foreign or disconnected connection %j",
            async (connection) => {
                const { service, connections, meta } = await build()
                connections.find.mockResolvedValue(connection)

                await expect(service.complete(callback)).resolves.toEqual(location("denied"))

                expect(connections.authorize).toHaveBeenCalledWith(actor, ["owner", "manager"])
                expect(connections.find).toHaveBeenCalledWith("ws-1", ID)
                expect(meta.exchangeCode).not.toHaveBeenCalled()
            },
        )

        it.each([
            { ...callback, error: "access_denied" },
            { ...callback, code: undefined },
            { ...callback, code: "" },
        ])("denies a refused consent or absent code %j", async (input) => {
            const { service, meta } = await build()

            await expect(service.complete(input)).resolves.toEqual(location("denied"))

            expect(meta.exchangeCode).not.toHaveBeenCalled()
        })

        it("denies an actor who no longer has a permitted role", async () => {
            const { service, connections } = await build()
            connections.authorize.mockRejectedValue(new ConnectionsError({ code: ConnectionsErrorCode.Forbidden }))

            await expect(service.complete(callback)).resolves.toEqual(location("denied"))
        })

        it.each([
            new ConnectionsError({ code: ConnectionsErrorCode.NotFound, params: { id: ID } }),
            new MetaError({ code: MetaErrorCode.Unreachable }),
            new Error("exchange failed"),
        ])("redirects every other callback failure %j", async (error) => {
            const { service, meta } = await build()
            meta.exchangeCode.mockRejectedValue(error)

            await expect(service.complete(callback)).resolves.toEqual(location("failed"))
        })

        it("reports when the user has no managed Pages", async () => {
            const { service, connections, meta } = await build()
            meta.listPages.mockResolvedValue([])

            await expect(service.complete(callback)).resolves.toEqual(location("nopages"))

            expect(meta.exchangeCode).toHaveBeenCalledWith("code-1")
            expect(meta.listPages).toHaveBeenCalledWith("user-token")
            expect(connections.writeSecret).not.toHaveBeenCalled()
        })

        it.each([null, seal(pageSecret)])(
            "stores Page choices with the existing selected credential %j",
            async (sealed) => {
                const { service, connections, meta } = await build()
                connections.readSecret.mockResolvedValue(sealed)

                await expect(service.complete({ ...callback, error: "" })).resolves.toEqual(location("ok"))

                expect(meta.exchangeCode).toHaveBeenCalledWith("code-1")
                expect(meta.listPages).toHaveBeenCalledWith("user-token")
                expect(connections.writeSecret).toHaveBeenCalledWith(
                    ID,
                    JSON.stringify({ ...(sealed === null ? {} : pageSecret), pages: [PAGE] }),
                )
            },
        )

        it("redirects a failure to save the received Page choices", async () => {
            const { service, connections } = await build()
            connections.writeSecret.mockRejectedValue(new Error("credential storage unavailable"))

            await expect(service.complete(callback)).resolves.toEqual(location("failed"))
        })
    })

    describe("answerChallenge and release", () => {
        it("delegates the verification query and returns its exact challenge", async () => {
            const { service, meta } = await build()
            const query = { mode: "subscribe", verifyToken: "verify-1", challenge: "challenge-1" }
            meta.challenge.mockReturnValue("challenge-1")

            await expect(service.respondToChallenge(query)).resolves.toBe("challenge-1")
            expect(meta.challenge).toHaveBeenCalledWith(query)
        })

        it("refuses a rejected challenge", async () => {
            const { service, meta } = await build()
            meta.challenge.mockReturnValue(null)

            expect(() =>
                service.answerChallenge({ mode: undefined, verifyToken: undefined, challenge: undefined }),
            ).toThrow(new ConnectionsError({ code: ConnectionsErrorCode.Forbidden }))
        })

        it("ignores a connection of another provider", async () => {
            const { service, connections, meta } = await build()

            await expect(service.release(record({ provider: "google" }))).resolves.toBeUndefined()

            expect(connections.readSecret).not.toHaveBeenCalled()
            expect(meta.unsubscribePage).not.toHaveBeenCalled()
        })

        it.each([{}, { pageId: "page-1" }, { pageToken: "page-token" }])(
            "ignores a credential without complete Page access %j",
            async (secret) => {
                const { service, connections, meta } = await build()
                connections.readSecret.mockResolvedValue(seal(secret))

                await expect(service.release(record())).resolves.toBeUndefined()

                expect(meta.unsubscribePage).not.toHaveBeenCalled()
            },
        )

        it("ignores a credential read failure", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockRejectedValue(new Error("decryption failed"))

            await expect(service.release(record())).resolves.toBeUndefined()

            expect(meta.unsubscribePage).not.toHaveBeenCalled()
        })

        it("unsubscribes a Page and tolerates a refusal", async () => {
            const { service, connections, meta } = await build()
            connections.readSecret.mockResolvedValue(seal(pageSecret))
            meta.unsubscribePage.mockRejectedValueOnce(
                new MetaError({ code: MetaErrorCode.Refused, params: { failure: "token" } }),
            )

            await expect(service.release(record())).resolves.toBeUndefined()
            await expect(service.release(record())).resolves.toBeUndefined()

            expect(meta.unsubscribePage.mock.calls).toEqual([
                ["page-1", "page-token"],
                ["page-1", "page-token"],
            ])
        })
    })
})
