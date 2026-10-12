import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { agentIdFor, AgentRegistryService, sessionKeyFor } from "./agent-registry.service"
import { OPENCLAW_OPTIONS } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"

const AGENT = "ws-0123abcd-chatbot"

describe("agent ids", () => {
    it("derives one agent per workspace and module and a session key inside it", () => {
        expect(agentIdFor("0123abcd-0000-4000-8000-000000000000", "Chat_Bot!")).toBe(AGENT)
        expect(sessionKeyFor(AGENT, "conv-1")).toBe(`agent:${AGENT}:conv-1`)
    })
})

describe("AgentRegistryService", () => {
    let dir = ""

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), "openclaw-registry-"))
    })

    afterEach(() => {
        rmSync(dir, { recursive: true, force: true })
    })

    const build = async (patch: Partial<OpenclawOptions> = {}) => {
        const options = {
            gateway: null,
            turnTimeoutMs: 90_000,
            configDir: dir,
            gatewayStateDir: "/home/node/.openclaw",
            manageAgents: true,
            toolSecret: null,
            ...patch,
        } satisfies OpenclawOptions
        const logger = mock<Logger>()
        const moduleRef = await Test.createTestingModule({
            providers: [
                AgentRegistryService,
                { provide: OPENCLAW_OPTIONS, useValue: options },
                { provide: LOGGER, useValue: logger },
            ],
        }).compile()
        return { registry: moduleRef.get(AgentRegistryService), logger }
    }

    const configFile = (): string => join(dir, "openclaw.json")
    const configOf = (): { agents: { list: Array<Record<string, unknown>> }; [key: string]: unknown } =>
        JSON.parse(readFileSync(configFile(), "utf8")) as never

    describe("workspaceDirs", () => {
        it("answers the local and the gateway view of the workspace", async () => {
            const { registry } = await build()

            expect(registry.workspaceDirs(AGENT)).toEqual({
                local: join(dir, `workspace-${AGENT}`),
                gateway: `/home/node/.openclaw/workspace-${AGENT}`,
            })
        })

        it("answers null without a config directory", async () => {
            const { registry } = await build({ configDir: undefined })

            expect(registry.workspaceDirs(AGENT)).toBeNull()
        })
    })

    describe("register", () => {
        it("writes the agent and keeps the implicit main agent as the default", async () => {
            const { registry, logger } = await build()
            writeFileSync(configFile(), JSON.stringify({ gateway: { reload: { mode: "hybrid" } } }))

            expect(registry.register(AGENT, "Bot")).toBe(true)

            const config = configOf()
            expect(config.gateway).toEqual({ reload: { mode: "hybrid" } })
            expect(config.agents.list).toEqual([
                { id: "main", default: true },
                {
                    id: AGENT,
                    name: "Bot",
                    workspace: `/home/node/.openclaw/workspace-${AGENT}`,
                    tools: { profile: "minimal" },
                    skills: [],
                    bootstrapMaxChars: 40_000,
                    bootstrapTotalMaxChars: 60_000,
                    thinkingDefault: "off",
                },
            ])
            expect(logger.info).toHaveBeenCalledTimes(1)
        })

        it("creates the file when there is none and does not rewrite an entry that is current", async () => {
            const { registry } = await build()

            expect(registry.register(AGENT, "Bot")).toBe(true)
            expect(registry.register(AGENT, "Bot")).toBe(false)
            expect(existsSync(configFile())).toBe(true)
        })

        it("corrects an entry that drifted and leaves other agents and keys alone", async () => {
            const { registry } = await build()
            writeFileSync(
                configFile(),
                JSON.stringify({
                    keep: 1,
                    agents: {
                        defaults: { x: 1 },
                        list: [
                            { id: "main", default: true },
                            { id: AGENT, name: "Old", extra: true },
                        ],
                    },
                }),
            )

            expect(registry.register(AGENT, "Bot")).toBe(true)

            const config = configOf()
            expect(config.keep).toBe(1)
            expect(config.agents).toMatchObject({ defaults: { x: 1 } })
            expect(config.agents.list).toHaveLength(2)
            expect(config.agents.list[1]).toMatchObject({ id: AGENT, name: "Bot", extra: true })
        })

        it("does not add a main agent when another entry is already the default", async () => {
            const { registry } = await build()
            writeFileSync(configFile(), JSON.stringify({ agents: { list: [{ id: "other", default: true }] } }))

            registry.register(AGENT, "Bot")

            expect(configOf().agents.list.map((entry) => entry.id)).toEqual(["other", AGENT])
        })

        it("treats a config that is not an object as empty", async () => {
            const { registry } = await build()
            writeFileSync(configFile(), "[1,2]")

            expect(registry.register(AGENT, "Bot")).toBe(true)
            expect(configOf().agents.list).toHaveLength(2)
        })

        it("refuses when registration is off or has no config directory", async () => {
            await expect(async () =>
                (await build({ manageAgents: false })).registry.register(AGENT, "Bot"),
            ).rejects.toMatchObject({
                code: OpenclawErrorCode.RegistrationOff,
            })
            await expect(async () =>
                (await build({ configDir: undefined })).registry.register(AGENT, "Bot"),
            ).rejects.toMatchObject({
                code: OpenclawErrorCode.RegistrationOff,
            })
        })
    })

    describe("has and isCurrent", () => {
        it("sees a registered agent and nothing before", async () => {
            const { registry } = await build()
            expect(registry.has(AGENT)).toBe(false)
            expect(registry.isCurrent(AGENT, "Bot")).toBe(false)

            registry.register(AGENT, "Bot")

            expect(registry.has(AGENT)).toBe(true)
            expect(registry.isCurrent(AGENT, "Bot")).toBe(true)
            expect(registry.isCurrent(AGENT, "Renamed")).toBe(false)
            expect(registry.has("ws-other-chatbot")).toBe(false)
            expect(registry.isCurrent("ws-other-chatbot", "Bot")).toBe(false)
        })

        it("answers false without a config directory", async () => {
            const { registry } = await build({ configDir: undefined })

            expect(registry.has(AGENT)).toBe(false)
            expect(registry.isCurrent(AGENT, "Bot")).toBe(false)
        })

        it("answers false when the config cannot be read", async () => {
            const { registry } = await build()
            writeFileSync(configFile(), "{ broken")

            expect(registry.has(AGENT)).toBe(false)
            expect(registry.isCurrent(AGENT, "Bot")).toBe(false)
        })

        it("answers false for an agent whose workspace points elsewhere", async () => {
            const { registry } = await build()
            writeFileSync(configFile(), JSON.stringify({ agents: { list: [{ id: AGENT, workspace: "/elsewhere" }] } }))

            expect(registry.has(AGENT)).toBe(false)
        })
    })
})
