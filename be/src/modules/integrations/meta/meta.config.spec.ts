import { EnvSource, Secret } from "@modules/platform/config"
import { parseMetaConfig } from "./meta.config"

const key = Buffer.alloc(32, 3).toString("base64")

describe("parseMetaConfig", () => {
    it("reads the app and overrides, using the API url before the site url", () => {
        const options = parseMetaConfig(
            new EnvSource({
                CHANNEL_TOKEN_KEY: key,
                META_APP_ID: "  meta-app  ",
                META_APP_SECRET: "meta-secret",
                META_WEBHOOK_VERIFY_TOKEN: "verify-token",
                META_LOGIN_CONFIG_ID: "login-config",
                META_GRAPH_VERSION: "v22.0",
                PUBLIC_API_URL: "https://api.example.com",
                PUBLIC_SITE_URL: "https://app.example.com",
                META_SEND_PER_MINUTE: "120",
                META_TIMEOUT: "4s",
            }),
        )

        expect(options).toEqual({
            app: { appId: "meta-app", appSecret: new Secret("meta-secret") },
            webhookVerifyToken: new Secret("verify-token"),
            loginConfigId: "login-config",
            graphVersion: "v22.0",
            siteUrl: "https://api.example.com",
            channelTokenKey: new Secret(key),
            sendPerMinute: 120,
            timeoutMs: 4000,
        })
    })

    it("falls back to the site url and defaults optional configuration", () => {
        expect(
            parseMetaConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key, PUBLIC_SITE_URL: "https://app.example.com" })),
        ).toEqual({
            app: null,
            webhookVerifyToken: undefined,
            loginConfigId: undefined,
            graphVersion: undefined,
            siteUrl: "https://app.example.com",
            channelTokenKey: new Secret(key),
            sendPerMinute: 60,
            timeoutMs: 15_000,
        })
    })

    it("leaves the site url undefined when neither url is declared", () => {
        expect(parseMetaConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key })).siteUrl).toBeUndefined()
    })

    it("leaves the app unavailable when its id is present without a secret", () => {
        expect(parseMetaConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key, META_APP_ID: "meta-app" })).app).toBeNull()
    })
})
