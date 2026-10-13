import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { parseN8nConfig } from "./n8n.config"

const N8N_CONFIG = Symbol("N8N_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: N8N_CONFIG, useFactory: parseN8nConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(N8N_CONFIG)
}

describe("parseN8nConfig", () => {
    it("requires the signing secret and defaults the rest", async () => {
        await expect(read({ N8N_SIGNING_SECRET: "sign-1" })).resolves.toEqual({
            signingSecret: new Secret("sign-1"),
            webhookBase: undefined,
            allowedHosts: [],
            timeoutMs: 10_000,
        })
    })

    it("reads the webhook base, the host list and a declared timeout", async () => {
        await expect(
            read({
                N8N_SIGNING_SECRET: "sign-1",
                N8N_WEBHOOK_BASE: "https://n8n.example/hook",
                N8N_ALLOWED_HOSTS: " n8n.example, , hooks.example ",
                N8N_EMIT_TIMEOUT: "4s",
            }),
        ).resolves.toEqual({
            signingSecret: new Secret("sign-1"),
            webhookBase: "https://n8n.example/hook",
            allowedHosts: ["n8n.example", "hooks.example"],
            timeoutMs: 4_000,
        })
    })
})
