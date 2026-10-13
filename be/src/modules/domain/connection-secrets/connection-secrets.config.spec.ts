import { Test } from "@nestjs/testing"
import { EnvSource } from "@modules/platform/config"
import { parseConnectionSecretsConfig } from "./connection-secrets.config"
import { CONNECTION_SECRETS_OPTIONS } from "./connection-secrets.decorators"
import type { ConnectionSecretsOptions } from "./connection-secrets.options"

const compile = (values: Readonly<Record<string, string | undefined>>) =>
    Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            {
                provide: CONNECTION_SECRETS_OPTIONS,
                useFactory: (env: EnvSource) => parseConnectionSecretsConfig(env),
                inject: [EnvSource],
            },
        ],
    }).compile()

describe("parseConnectionSecretsConfig", () => {
    it("reads the sealing key as a secret", async () => {
        const moduleRef = await compile({ CHANNEL_TOKEN_KEY: "sealed-key-value" })

        expect(moduleRef.get<ConnectionSecretsOptions>(CONNECTION_SECRETS_OPTIONS).tokenKey.reveal()).toBe(
            "sealed-key-value",
        )
        await moduleRef.close()
    })

    it("refuses to boot when the sealing key is missing", async () => {
        await expect(compile({})).rejects.toMatchObject({
            name: "ConfigError",
            message: "CONFIG_KEY_MISSING",
            code: "CONFIG_KEY_MISSING",
            params: { key: "CHANNEL_TOKEN_KEY" },
        })
    })
})
