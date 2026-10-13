import { Test } from "@nestjs/testing"
import { EnvSource, Secret } from "@modules/platform/config"
import { OpenclawError, OpenclawErrorCode } from "./errors/openclaw.error"
import { parseOpenclawConfig } from "./openclaw.config"

const OPENCLAW_CONFIG = Symbol("OPENCLAW_CONFIG")

const read = async (values: Record<string, string>) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            { provide: EnvSource, useValue: new EnvSource(values) },
            { provide: OPENCLAW_CONFIG, useFactory: parseOpenclawConfig, inject: [EnvSource] },
        ],
    }).compile()
    return moduleRef.get(OPENCLAW_CONFIG)
}

const invalid = (key: string): OpenclawError =>
    new OpenclawError({ code: OpenclawErrorCode.ConfigInvalid, params: { key } })

describe("parseOpenclawConfig", () => {
    it("leaves the gateway off and uses the turn defaults", async () => {
        await expect(read({})).resolves.toEqual({
            gateway: null,
            turnTimeoutMs: 90_000,
            settleMs: 3_000,
            configDir: undefined,
            gatewayStateDir: "/home/node/.openclaw",
            manageAgents: false,
            toolSecret: null,
        })
    })

    it("reads a token gateway and strips a trailing slash from the state directory", async () => {
        await expect(
            read({
                OPENCLAW_GATEWAY_URL: "wss://gateway.example/openclaw",
                OPENCLAW_GATEWAY_TOKEN: "token-1",
                OPENCLAW_TURN_TIMEOUT: "5s",
                OPENCLAW_SETTLE_DELAY: "1s",
                OPENCLAW_CONFIG_DIR: "/config",
                OPENCLAW_GATEWAY_STATE_DIR: "/state/",
                OPENCLAW_MANAGE_AGENTS: "true",
                OPENCLAW_TOOL_SECRET: "tool-1",
            }),
        ).resolves.toEqual({
            gateway: { url: "wss://gateway.example/openclaw", auth: { kind: "token", token: new Secret("token-1") } },
            turnTimeoutMs: 5_000,
            settleMs: 1_000,
            configDir: "/config",
            gatewayStateDir: "/state",
            manageAgents: true,
            toolSecret: new Secret("tool-1"),
        })
    })

    it("prefers a password when no token is declared and refuses a gateway that is not a websocket", async () => {
        await expect(
            read({ OPENCLAW_GATEWAY_URL: "ws://gateway.example", OPENCLAW_GATEWAY_PASSWORD: "pw-1" }),
        ).resolves.toMatchObject({
            gateway: { url: "ws://gateway.example", auth: { kind: "password", password: new Secret("pw-1") } },
        })
        await expect(read({ OPENCLAW_GATEWAY_TOKEN: "token-1" })).resolves.toMatchObject({ gateway: null })
        await expect(
            read({ OPENCLAW_GATEWAY_URL: "https://gateway.example", OPENCLAW_GATEWAY_TOKEN: "token-1" }),
        ).rejects.toEqual(invalid("OPENCLAW_GATEWAY_URL"))
    })

    it("refuses a turn timeout outside five seconds to ten minutes", async () => {
        await expect(read({ OPENCLAW_TURN_TIMEOUT: "4999ms" })).rejects.toEqual(invalid("OPENCLAW_TURN_TIMEOUT"))
        await expect(read({ OPENCLAW_TURN_TIMEOUT: "600001ms" })).rejects.toEqual(invalid("OPENCLAW_TURN_TIMEOUT"))
        await expect(read({ OPENCLAW_TURN_TIMEOUT: "600s" })).resolves.toMatchObject({ turnTimeoutMs: 600_000 })
    })
})
