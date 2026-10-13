import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseZaloConfig } from "./zalo.config"

const ZALO_CONFIG = Symbol("ZALO_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: ZALO_CONFIG, useFactory: parseZaloConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(ZALO_CONFIG)
}

describe("parseZaloConfig", () => {
    it("uses the public Zalo hosts and a ten second timeout", async () => {
        await expect(read({})).resolves.toEqual({
            oauthBase: "https://oauth.zaloapp.com",
            apiBase: "https://openapi.zalo.me",
            timeoutMs: 10_000,
        })
    })

    it("drops one trailing slash from declared hosts", async () => {
        await expect(
            read({
                ZALO_OAUTH_BASE: "https://oauth.example/",
                ZALO_API_BASE: "https://api.example",
                ZALO_TIMEOUT: "2s",
            }),
        ).resolves.toEqual({
            oauthBase: "https://oauth.example",
            apiBase: "https://api.example",
            timeoutMs: 2_000,
        })
    })
})
