import { Secret } from "@modules/platform/config"
import {
    DEFAULT_GRAPH_VERSION,
    authorizeUrl,
    dialogUrl,
    graphUrl,
    graphVersion,
    isPublicSite,
    redirectUri,
    webhookUrl,
} from "./meta-url.policy"

const APP = { appId: "app-1", appSecret: new Secret("secret-1") }

describe("graphVersion", () => {
    it("accepts v21 or later and falls back otherwise", () => {
        expect(graphVersion({ graphVersion: "v23.1" })).toBe("v23.1")
        expect(graphVersion({ graphVersion: " v21.0 " })).toBe("v21.0")
        expect(graphVersion({ graphVersion: "v19.0" })).toBe(DEFAULT_GRAPH_VERSION)
        expect(graphVersion({ graphVersion: "latest" })).toBe(DEFAULT_GRAPH_VERSION)
        expect(graphVersion({ graphVersion: undefined })).toBe(DEFAULT_GRAPH_VERSION)
    })
})

describe("graphUrl and dialogUrl", () => {
    it("builds the Graph url with defined params only", () => {
        const url = new URL(
            graphUrl({ graphVersion: undefined }, "/me/accounts", { limit: 50, after: undefined, ok: true }),
        )

        expect(url.origin + url.pathname).toBe("https://graph.facebook.com/v21.0/me/accounts")
        expect(url.searchParams.get("limit")).toBe("50")
        expect(url.searchParams.get("ok")).toBe("true")
        expect(url.searchParams.has("after")).toBe(false)
        expect(graphUrl({ graphVersion: undefined }, "x")).toBe("https://graph.facebook.com/v21.0/x")
    })

    it("builds the login dialog url", () => {
        const url = new URL(dialogUrl({ graphVersion: "v22.0" }, { client_id: "c", state: undefined }))

        expect(url.origin + url.pathname).toBe("https://www.facebook.com/v22.0/dialog/oauth")
        expect(url.searchParams.get("client_id")).toBe("c")
        expect(url.searchParams.has("state")).toBe(false)
    })
})

describe("callback urls", () => {
    it("keep the provider paths byte-identical and need a site url", () => {
        expect(redirectUri({ siteUrl: "https://nivo.vn/" })).toBe("https://nivo.vn/api/connections/meta/callback")
        expect(webhookUrl({ siteUrl: "https://nivo.vn" })).toBe("https://nivo.vn/api/connections/meta/webhook")
        expect(redirectUri({ siteUrl: undefined })).toBeNull()
        expect(webhookUrl({ siteUrl: undefined })).toBeNull()
    })
})

describe("isPublicSite", () => {
    it("is true only for a public https origin", () => {
        expect(isPublicSite({ siteUrl: "https://nivo.vn" })).toBe(true)
        expect(isPublicSite({ siteUrl: "http://nivo.vn" })).toBe(false)
        expect(isPublicSite({ siteUrl: "https://localhost:3100" })).toBe(false)
        expect(isPublicSite({ siteUrl: "https://app.localhost" })).toBe(false)
        expect(isPublicSite({ siteUrl: "https://127.0.0.1" })).toBe(false)
        expect(isPublicSite({ siteUrl: "https://[::1]" })).toBe(false)
        expect(isPublicSite({ siteUrl: "nonsense" })).toBe(false)
        expect(isPublicSite({ siteUrl: undefined })).toBe(false)
    })
})

describe("authorizeUrl", () => {
    const base = { app: APP, siteUrl: "https://nivo.vn", graphVersion: undefined, loginConfigId: undefined }

    it("asks for the scope list without a login configuration", () => {
        const url = new URL(authorizeUrl(base, "state-1") ?? "")

        expect(url.searchParams.get("scope")).toContain("pages_messaging")
        expect(url.searchParams.get("redirect_uri")).toBe("https://nivo.vn/api/connections/meta/callback")
        expect(url.searchParams.get("state")).toBe("state-1")
        expect(url.searchParams.has("config_id")).toBe(false)
    })

    it("uses the login configuration when one is set", () => {
        const url = new URL(authorizeUrl({ ...base, loginConfigId: " cfg-1 " }, "s") ?? "")

        expect(url.searchParams.get("config_id")).toBe("cfg-1")
        expect(url.searchParams.get("override_default_response_type")).toBe("true")
        expect(url.searchParams.has("scope")).toBe(false)
    })

    it("is null without the app or the site url", () => {
        expect(authorizeUrl({ ...base, app: null }, "s")).toBeNull()
        expect(authorizeUrl({ ...base, siteUrl: undefined }, "s")).toBeNull()
    })
})
