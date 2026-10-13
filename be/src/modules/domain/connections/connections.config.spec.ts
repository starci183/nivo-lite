import { randomBytes } from "node:crypto"
import { EnvSource } from "@modules/platform/config"
import { parseConnectionsConfig } from "./connections.config"
import { ConnectionsErrorCode } from "./errors/connections.error"

const key = randomBytes(32).toString("base64")

describe("parseConnectionsConfig", () => {
    it("reads the key as a secret and the optional site url", () => {
        const options = parseConnectionsConfig(
            new EnvSource({ CHANNEL_TOKEN_KEY: key, PUBLIC_SITE_URL: "https://app.example.com" }),
        )

        expect(options.channelTokenKey.reveal()).toBe(key)
        expect(options.publicSiteUrl).toBe("https://app.example.com")
    })

    it("leaves the site url undefined when it is not declared", () => {
        expect(parseConnectionsConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key })).publicSiteUrl).toBeUndefined()
    })

    it("refuses a key that is not 32 bytes", () => {
        expect(() =>
            parseConnectionsConfig(new EnvSource({ CHANNEL_TOKEN_KEY: randomBytes(16).toString("base64") })),
        ).toThrow(expect.objectContaining({ code: ConnectionsErrorCode.KeyInvalid }))
    })

    it("refuses a missing key", () => {
        expect(() => parseConnectionsConfig(new EnvSource({}))).toThrow()
    })

    it("reads the API url separately from the site url", () => {
        const options = parseConnectionsConfig(
            new EnvSource({
                CHANNEL_TOKEN_KEY: key,
                PUBLIC_SITE_URL: "https://app.example.com",
                PUBLIC_API_URL: "https://api.example.com",
            }),
        )

        expect(options.publicApiUrl).toBe("https://api.example.com")
        expect(options.publicSiteUrl).toBe("https://app.example.com")
    })

    it("leaves the API url undefined when only the site url is declared", () => {
        const options = parseConnectionsConfig(
            new EnvSource({ CHANNEL_TOKEN_KEY: key, PUBLIC_SITE_URL: "https://app.example.com" }),
        )

        expect(options.publicApiUrl).toBeUndefined()
        expect(options.publicSiteUrl).toBe("https://app.example.com")
    })

    it("reads the API url when no site url is declared", () => {
        const options = parseConnectionsConfig(
            new EnvSource({ CHANNEL_TOKEN_KEY: key, PUBLIC_API_URL: "https://api.example.com" }),
        )

        expect(options.publicApiUrl).toBe("https://api.example.com")
        expect(options.publicSiteUrl).toBeUndefined()
    })

    it("leaves both public urls undefined when neither is declared", () => {
        const options = parseConnectionsConfig(new EnvSource({ CHANNEL_TOKEN_KEY: key }))

        expect(options.publicApiUrl).toBeUndefined()
        expect(options.publicSiteUrl).toBeUndefined()
    })
})
