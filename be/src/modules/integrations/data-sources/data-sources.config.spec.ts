import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseDataSourcesConfig } from "./data-sources.config"

const DATA_SOURCES_CONFIG = Symbol("DATA_SOURCES_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: DATA_SOURCES_CONFIG, useFactory: parseDataSourcesConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(DATA_SOURCES_CONFIG)
}

describe("parseDataSourcesConfig", () => {
    it.each([
        ["a missing site", {}],
        ["an unparsable site", { SITE_URL: "not a url" }],
        ["a plain-http site", { SITE_URL: "http://shop.example" }],
        ["localhost", { SITE_URL: "https://localhost" }],
        ["a loopback address", { SITE_URL: "https://127.0.0.1" }],
        ["a localhost subdomain", { SITE_URL: "https://app.localhost" }],
    ])("allows private hosts on %s", async (_site, values) => {
        await expect(read(values)).resolves.toEqual({ allowPrivateHosts: true, telegramUser: null })
    })

    it("keeps private hosts off a public site unless the flag says otherwise", async () => {
        await expect(read({ SITE_URL: "https://nivo.vn" })).resolves.toEqual({
            allowPrivateHosts: false,
            telegramUser: null,
        })
        await expect(read({ SITE_URL: "https://nivo.vn", DATA_ALLOW_PRIVATE_HOSTS: "true" })).resolves.toEqual({
            allowPrivateHosts: true,
            telegramUser: null,
        })
    })

    it("reads Telegram only when either credential is declared", async () => {
        await expect(
            read({ SITE_URL: "https://nivo.vn", TELEGRAM_API_ID: "100", TELEGRAM_API_HASH: "hash-1" }),
        ).resolves.toEqual({
            allowPrivateHosts: false,
            telegramUser: { apiId: 100, apiHash: new Secret("hash-1") },
        })
    })
})
