import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseTelegramConfig } from "./telegram.config"

const TELEGRAM_CONFIG = Symbol("TELEGRAM_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: TELEGRAM_CONFIG, useFactory: parseTelegramConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(TELEGRAM_CONFIG)
}

describe("parseTelegramConfig", () => {
    it("uses the public Bot API and a ten second timeout", async () => {
        await expect(read({})).resolves.toEqual({ apiBase: "https://api.telegram.org", timeoutMs: 10_000 })
    })

    it("drops one trailing slash from a declared base", async () => {
        await expect(read({ TELEGRAM_API_BASE: "https://telegram.example/", TELEGRAM_TIMEOUT: "2s" })).resolves.toEqual(
            {
                apiBase: "https://telegram.example",
                timeoutMs: 2_000,
            },
        )
        await expect(read({ TELEGRAM_API_BASE: "https://telegram.example" })).resolves.toMatchObject({
            apiBase: "https://telegram.example",
        })
    })
})
