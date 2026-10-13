import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseChannelSetupConfig } from "./channel-setup.config"

const CHANNEL_SETUP_CONFIG = Symbol("CHANNEL_SETUP_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: CHANNEL_SETUP_CONFIG, useFactory: parseChannelSetupConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(CHANNEL_SETUP_CONFIG)
}

describe("parseChannelSetupConfig", () => {
    it("leaves the hosts unset and waits ten seconds when nothing is declared", async () => {
        await expect(read({})).resolves.toEqual({
            zaloOauthBase: undefined,
            siteUrl: undefined,
            timeoutMs: 10_000,
        })
    })

    it("reads the hosts and a declared timeout", async () => {
        await expect(
            read({
                ZALO_OAUTH_BASE: "https://oauth.example",
                PUBLIC_SITE_URL: "https://nivo.vn",
                CHANNEL_SETUP_TIMEOUT: "4s",
            }),
        ).resolves.toEqual({
            zaloOauthBase: "https://oauth.example",
            siteUrl: "https://nivo.vn",
            timeoutMs: 4_000,
        })
    })
})
