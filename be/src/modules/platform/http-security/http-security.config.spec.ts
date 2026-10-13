import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseHttpSecurityConfig, parseWebhookProviderConfig } from "./http-security.config"

const HTTP_SECURITY_CONFIG = Symbol("HTTP_SECURITY_CONFIG")
const WEBHOOK_CONFIG = Symbol("WEBHOOK_CONFIG")

describe("parseHttpSecurityConfig", () => {
    it("splits the origin list and keeps the rate-limit defaults", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                {
                    provide: EnvSource,
                    useValue: new EnvSource({
                        HTTP_SECURITY_ALLOWED_ORIGINS: " https://nivo.vn, ,https://app.nivo.vn ",
                    }),
                },
                { provide: HTTP_SECURITY_CONFIG, useFactory: parseHttpSecurityConfig, inject: [EnvSource] },
            ],
        }).compile()

        expect(moduleRef.get(HTTP_SECURITY_CONFIG)).toEqual({
            allowedOrigins: ["https://nivo.vn", "https://app.nivo.vn"],
            rateLimit: { windowMs: 60_000, defaultLimit: 600, strictLimit: 30 },
            webhooks: {},
        })
    })

    it("reads declared rate limits", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                {
                    provide: EnvSource,
                    useValue: new EnvSource({
                        HTTP_SECURITY_ALLOWED_ORIGINS: "https://nivo.vn",
                        HTTP_SECURITY_RATE_WINDOW: "30s",
                        HTTP_SECURITY_RATE_DEFAULT_LIMIT: "100",
                        HTTP_SECURITY_RATE_STRICT_LIMIT: "5",
                    }),
                },
                { provide: HTTP_SECURITY_CONFIG, useFactory: parseHttpSecurityConfig, inject: [EnvSource] },
            ],
        }).compile()

        expect(moduleRef.get(HTTP_SECURITY_CONFIG)).toEqual({
            allowedOrigins: ["https://nivo.vn"],
            rateLimit: { windowMs: 30_000, defaultLimit: 100, strictLimit: 5 },
            webhooks: {},
        })
    })
})

describe("parseWebhookProviderConfig", () => {
    const read = async (values: Record<string, string>) => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                { provide: EnvSource, useValue: new EnvSource(values) },
                {
                    provide: WEBHOOK_CONFIG,
                    useFactory: (env: EnvSource) => parseWebhookProviderConfig(env, "SEPAY"),
                    inject: [EnvSource],
                },
            ],
        }).compile()
        return moduleRef.get(WEBHOOK_CONFIG)
    }

    it("reads the signing secret and the default five minute window", async () => {
        await expect(read({ SEPAY_WEBHOOK_SECRET: "sign-1" })).resolves.toEqual({
            secret: new Secret("sign-1"),
            toleranceMs: 300_000,
        })
    })

    it("reads a declared replay window", async () => {
        await expect(read({ SEPAY_WEBHOOK_SECRET: "sign-1", SEPAY_WEBHOOK_TOLERANCE: "2m" })).resolves.toEqual({
            secret: new Secret("sign-1"),
            toleranceMs: 120_000,
        })
    })
})
