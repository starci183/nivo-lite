import { EnvSource, Secret } from "@modules/platform/config"
import { parseGoogleConfig } from "./google.config"

const key = Buffer.alloc(32, 9).toString("base64")

describe("parseGoogleConfig", () => {
    it("reads the Google client and overrides, using the API url before the site url", () => {
        const options = parseGoogleConfig(
            new EnvSource({
                CHANNEL_TOKEN_KEY: key,
                GOOGLE_OAUTH_CLIENT_ID: "google-client",
                GOOGLE_OAUTH_CLIENT_SECRET: "google-secret",
                SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "supabase-client",
                SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "supabase-secret",
                GOOGLE_OAUTH_BASE: "https://oauth.example.com",
                GOOGLE_SHEETS_BASE: "https://sheets.example.com",
                PUBLIC_API_URL: "https://api.example.com",
                PUBLIC_SITE_URL: "https://app.example.com",
                GOOGLE_TIMEOUT: "3s",
            }),
        )

        expect(options).toEqual({
            client: { clientId: "google-client", clientSecret: new Secret("google-secret") },
            oauthBase: "https://oauth.example.com",
            sheetsBase: "https://sheets.example.com",
            siteUrl: "https://api.example.com",
            channelTokenKey: new Secret(key),
            timeoutMs: 3000,
        })
    })

    it("falls back to the Supabase client and the site url", () => {
        const options = parseGoogleConfig(
            new EnvSource({
                CHANNEL_TOKEN_KEY: key,
                SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: "supabase-client",
                SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET: "supabase-secret",
                PUBLIC_SITE_URL: "https://app.example.com",
            }),
        )

        expect(options).toEqual({
            client: { clientId: "supabase-client", clientSecret: new Secret("supabase-secret") },
            oauthBase: undefined,
            sheetsBase: undefined,
            siteUrl: "https://app.example.com",
            channelTokenKey: new Secret(key),
            timeoutMs: 10_000,
        })
    })

    it("leaves the client unavailable and the site url undefined when neither url is declared", () => {
        expect(parseGoogleConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key }))).toEqual({
            client: null,
            oauthBase: undefined,
            sheetsBase: undefined,
            siteUrl: undefined,
            channelTokenKey: new Secret(key),
            timeoutMs: 10_000,
        })
    })

    it("leaves the client unavailable when its id is present without a secret", () => {
        expect(
            parseGoogleConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key, GOOGLE_OAUTH_CLIENT_ID: "google-client" }))
                .client,
        ).toBeNull()
    })
})
