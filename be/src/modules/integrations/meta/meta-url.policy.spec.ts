import { Test } from "@nestjs/testing"

import { Secret } from "@modules/platform/config"

import {
    DEFAULT_GRAPH_VERSION,
    authorizeUrl as realAuthorizeUrl,
    dialogUrl as realDialogUrl,
    graphUrl as realGraphUrl,
    graphVersion as realGraphVersion,
    isPublicSite as realIsPublicSite,
    redirectUri as realRedirectUri,
    webhookUrl as realWebhookUrl,
} from "./meta-url.policy"

const SUBJECT = Symbol("meta-url.policy")

const functions = {
    authorizeUrl: realAuthorizeUrl,
    dialogUrl: realDialogUrl,
    graphUrl: realGraphUrl,
    graphVersion: realGraphVersion,
    isPublicSite: realIsPublicSite,
    redirectUri: realRedirectUri,
    webhookUrl: realWebhookUrl,
}

const APP = { appId: "app-1", appSecret: new Secret("secret-1") }

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: {
                    authorizeUrl: realAuthorizeUrl,
                    dialogUrl: realDialogUrl,
                    graphUrl: realGraphUrl,
                    graphVersion: realGraphVersion,
                    isPublicSite: realIsPublicSite,
                    redirectUri: realRedirectUri,
                    webhookUrl: realWebhookUrl,
                },
            },
        ],
    }).compile()
    const subject = moduleRef.get<typeof functions>(SUBJECT)

    return { subject }
}

describe("graphVersion", () => {
    it("accepts v21 or later and falls back otherwise", async () => {
        const { subject } = await buildSubject()

        expect(subject.graphVersion({ graphVersion: "v23.1" })).toBe("v23.1")
        expect(subject.graphVersion({ graphVersion: " v21.0 " })).toBe("v21.0")
        expect(subject.graphVersion({ graphVersion: "v19.0" })).toBe(DEFAULT_GRAPH_VERSION)
        expect(subject.graphVersion({ graphVersion: "latest" })).toBe(DEFAULT_GRAPH_VERSION)
        expect(subject.graphVersion({ graphVersion: undefined })).toBe(DEFAULT_GRAPH_VERSION)
    })
})

describe("graphUrl and dialogUrl", () => {
    it("builds the Graph url with defined params only", async () => {
        const { subject } = await buildSubject()

        const url = new URL(
            subject.graphUrl({ graphVersion: undefined }, "/me/accounts", {
                limit: 50,
                after: undefined,
                ok: true,
            }),
        )

        expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/me/accounts")
        expect(url.searchParams.get("limit")).toBe("50")
        expect(url.searchParams.get("ok")).toBe("true")
        expect(url.searchParams.has("after")).toBe(false)
        expect(subject.graphUrl({ graphVersion: undefined }, "x")).toBe("https://graph.facebook.com/v21.0/x")
    })

    it("builds the login dialog url", async () => {
        const { subject } = await buildSubject()

        const url = new URL(subject.dialogUrl({ graphVersion: "v22.0" }, { client_id: "c", state: undefined }))

        expect(url.origin + url.pathname).toBe("https://www.facebook.com/v22.0/dialog/oauth")
        expect(url.searchParams.get("client_id")).toBe("c")
        expect(url.searchParams.has("state")).toBe(false)
    })
})

describe("callback urls", () => {
    it("drops a long trailing separator run and keeps the provider callback path", async () => {
        const { subject } = await buildSubject()
        expect(subject.redirectUri({ siteUrl: "https://nivo.vn/app" + "/".repeat(20_000) })).toBe(
            "https://nivo.vn/app/api/connections/meta/callback",
        )
    })

    it("keep the provider paths byte-identical and need a site url", async () => {
        const { subject } = await buildSubject()

        expect(subject.redirectUri({ siteUrl: "https://nivo.vn/" })).toBe(
            "https://nivo.vn/api/connections/meta/callback",
        )
        expect(subject.webhookUrl({ siteUrl: "https://nivo.vn" })).toBe("https://nivo.vn/api/connections/meta/webhook")
        expect(subject.redirectUri({ siteUrl: undefined })).toBeNull()
        expect(subject.webhookUrl({ siteUrl: undefined })).toBeNull()
    })
})

describe("isPublicSite", () => {
    it("is true only for a public https origin", async () => {
        const { subject } = await buildSubject()

        expect(subject.isPublicSite({ siteUrl: "https://nivo.vn" })).toBe(true)
        expect(subject.isPublicSite({ siteUrl: "http://nivo.vn" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: "https://localhost:3100" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: "https://app.localhost" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: "https://127.0.0.1" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: "https://[::1]" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: "nonsense" })).toBe(false)
        expect(subject.isPublicSite({ siteUrl: undefined })).toBe(false)
    })
})

describe("authorizeUrl", () => {
    const base = { app: APP, siteUrl: "https://nivo.vn", graphVersion: undefined, loginConfigId: undefined }

    it("asks for the scope list without a login configuration", async () => {
        const { subject } = await buildSubject()

        const url = new URL(subject.authorizeUrl(base, "state-1") ?? "")

        expect(url.searchParams.get("scope")).toContain("pages_messaging")
        expect(url.searchParams.get("redirect_uri")).toBe("https://nivo.vn/api/connections/meta/callback")
        expect(url.searchParams.get("state")).toBe("state-1")
        expect(url.searchParams.has("config_id")).toBe(false)
    })

    it("uses the login configuration when one is set", async () => {
        const { subject } = await buildSubject()

        const url = new URL(subject.authorizeUrl({ ...base, loginConfigId: " cfg-1 " }, "s") ?? "")

        expect(url.searchParams.get("config_id")).toBe("cfg-1")
        expect(url.searchParams.get("override_default_response_type")).toBe("true")
        expect(url.searchParams.has("scope")).toBe(false)
    })

    it("is null without the app or the site url", async () => {
        const { subject } = await buildSubject()

        expect(subject.authorizeUrl({ ...base, app: null }, "s")).toBeNull()
        expect(subject.authorizeUrl({ ...base, siteUrl: undefined }, "s")).toBeNull()
    })
})
