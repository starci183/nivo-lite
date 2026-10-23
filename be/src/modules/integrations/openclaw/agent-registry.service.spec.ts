import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { OpenclawErrorCode } from "./errors/openclaw.error"
import { AgentRegistryService } from "./agent-registry.service"
import { OPENCLAW_FILES, OPENCLAW_OPTIONS } from "./openclaw.decorators"
import type { OpenclawOptions } from "./openclaw.options"
import type { OpenclawFiles } from "./openclaw-files.port"

/** A partial-object matcher, typed `unknown` so it flows into any slot. */
const objectLike = (shape: Record<string, unknown>): unknown => expect.objectContaining(shape)

/** What `run` throws, read as `unknown`; the matcher then judges its fields. */
const thrownBy = (run: () => unknown): unknown => {
    try {
        run()
    } catch (error) {
        return error
    }
    return undefined
}

const AGENT = "ws-0123abcd-chatbot"
const CONFIG = "/state/openclaw.json"

/** A disk in memory: the files port over a map of path to text. */
const memoryFiles = (initial: Record<string, string> = {}) => {
    const store = new Map(Object.entries(initial))
    const files: Partial<OpenclawFiles> = {
        readText: jest.fn((path: string) => store.get(path) ?? null),
        writeText: jest.fn((path: string, content: string) => {
            store.set(path, content)
        }),
    }
    return { files, store }
}

const build = async (overrides: Partial<OpenclawOptions> = {}, disk = memoryFiles()) => {
    const options = builder<OpenclawOptions>({
        gateway: null,
        turnTimeoutMs: 90_000,
        settleMs: 3000,
        configDir: "/state",
        gatewayStateDir: "/home/node/.openclaw",
        manageAgents: true,
        toolSecret: null,
    })(overrides)
    const files = mock<OpenclawFiles>(disk.files)
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentRegistryService,
            { provide: OPENCLAW_OPTIONS, useValue: options },
            { provide: OPENCLAW_FILES, useValue: files },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { registry: moduleRef.get(AgentRegistryService), logger }
}

interface StoredAgents {
    list: Array<Record<string, unknown>>
}

interface Stored {
    agents: StoredAgents
    [key: string]: unknown
}

const isStored = (value: unknown): value is Stored => typeof value === "object" && value !== null && "agents" in value

/** The stored openclaw.json as a plain object. */
const stored = (store: Map<string, string>): Stored => {
    try {
        const value: unknown = JSON.parse(store.get(CONFIG) ?? "{}")
        return isStored(value) ? value : { agents: { list: [] } }
    } catch (cause) {
        throw cause
    }
}

describe("AgentRegistryService", () => {
    describe("workspaceDirs", () => {
        it("answers the local and the gateway view of the workspace", async () => {
            const { registry } = await build()

            expect(registry.workspaceDirs(AGENT)).toEqual({
                local: `/state/workspace-${AGENT}`,
                gateway: `/home/node/.openclaw/workspace-${AGENT}`,
            })
        })

        it("answers null without a config directory", async () => {
            const { registry } = await build({ configDir: undefined })

            expect(registry.workspaceDirs(AGENT)).toBeNull()
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("writes the agent and keeps the implicit main agent as the default", async () => {
            const disk = memoryFiles({ [CONFIG]: JSON.stringify({ gateway: { reload: { mode: "hybrid" } } }) })
            const { registry, logger } = await build({}, disk)

            expect(registry.register(AGENT, "Bot")).toBe(true)

            const config = stored(disk.store)
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
            expect(disk.files.writeText).toHaveBeenCalledWith(CONFIG, disk.store.get(CONFIG), 0o600)
            expect(logger.info).toHaveBeenCalledTimes(1)
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("creates the file when there is none and does not rewrite an entry that is current", async () => {
            const disk = memoryFiles()
            const { registry } = await build({}, disk)

            expect(registry.register(AGENT, "Bot")).toBe(true)
            expect(registry.register(AGENT, "Bot")).toBe(false)
            expect(disk.files.writeText).toHaveBeenCalledTimes(1)
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("corrects an entry that drifted and leaves other agents, entries and keys alone", async () => {
            const disk = memoryFiles({
                [CONFIG]: JSON.stringify({
                    keep: 1,
                    agents: {
                        defaults: { x: 1 },
                        list: ["not an entry", { id: "main", default: true }, { id: AGENT, name: "Old", extra: true }],
                    },
                }),
            })
            const { registry } = await build({}, disk)

            expect(registry.register(AGENT, "Bot")).toBe(true)

            const config = stored(disk.store)
            expect(config.keep).toBe(1)
            expect(config.agents).toMatchObject({ defaults: { x: 1 } })
            expect(config.agents.list).toHaveLength(3)
            expect(config.agents.list[0]).toBe("not an entry")
            expect(config.agents.list[2]).toMatchObject({ id: AGENT, name: "Bot", extra: true })
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("does not add a main agent when another entry is already the default", async () => {
            const disk = memoryFiles({
                [CONFIG]: JSON.stringify({ agents: { list: [{ id: "other", default: true }] } }),
            })
            const { registry } = await build({}, disk)

            registry.register(AGENT, "Bot")

            expect(stored(disk.store).agents.list.map((entry) => entry["id"])).toEqual(["other", AGENT])
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("treats a config that is not an object as empty", async () => {
            const disk = memoryFiles({ [CONFIG]: "[1,2]" })
            const { registry } = await build({}, disk)

            expect(registry.register(AGENT, "Bot")).toBe(true)
            expect(stored(disk.store).agents.list).toHaveLength(2)
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("refuses when registration is off or has no config directory", async () => {
            const off = await build({ manageAgents: false })
            const none = await build({ configDir: undefined })

            expect(thrownBy(() => off.registry.register(AGENT, "Bot"))).toEqual(
                objectLike({ code: OpenclawErrorCode.RegistrationOff }),
            )
            expect(thrownBy(() => none.registry.register(AGENT, "Bot"))).toEqual(
                objectLike({ code: OpenclawErrorCode.RegistrationOff }),
            )
        })
    })
})

describe("AgentRegistryService", () => {
    describe("register", () => {
        it("refuses to overwrite a config it cannot read", async () => {
            const disk = memoryFiles({ [CONFIG]: "{ broken" })
            const { registry, logger } = await build({}, disk)

            expect(thrownBy(() => registry.register(AGENT, "Bot"))).toEqual(
                objectLike({ code: OpenclawErrorCode.ConfigInvalid }),
            )
            expect(logger.error).toHaveBeenCalledTimes(1)
            expect(disk.store.get(CONFIG)).toBe("{ broken")
        })
    })
})

describe("AgentRegistryService", () => {
    describe("has and isCurrent", () => {
        it("sees a registered agent and nothing before", async () => {
            const disk = memoryFiles()
            const { registry } = await build({}, disk)
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
            const { registry } = await build({}, memoryFiles({ [CONFIG]: "{ broken" }))

            expect(registry.has(AGENT)).toBe(false)
            expect(registry.isCurrent(AGENT, "Bot")).toBe(false)
        })

        it("answers false for an agent whose workspace points elsewhere", async () => {
            const disk = memoryFiles({
                [CONFIG]: JSON.stringify({ agents: { list: [{ id: AGENT, workspace: "/elsewhere" }] } }),
            })
            const { registry } = await build({}, disk)

            expect(registry.has(AGENT)).toBe(false)
        })
    })
})
