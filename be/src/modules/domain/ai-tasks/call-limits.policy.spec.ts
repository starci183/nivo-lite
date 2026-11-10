import { Test } from "@nestjs/testing"
import { WORK_ATTEMPT_TIMEOUT_MS } from "@modules/integrations/ai-gateway"
import { parseAiTasksConfig } from "./ai-tasks.config"
import { NODE_TIMEOUT_CEILING_MS, callLimitsOf } from "./call-limits.policy"

const SUBJECT = Symbol("call-limits.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { callLimitsOf, parseAiTasksConfig } }],
    }).compile()
    return moduleRef.get<{ callLimitsOf: typeof callLimitsOf; parseAiTasksConfig: typeof parseAiTasksConfig }>(SUBJECT)
}

/** The part of the env reader the config uses, over plain values. */
const envOf = (values: Readonly<Record<string, string>>) =>
    ({
        int: (key: string, fallback: number) => (values[key] === undefined ? fallback : Number(values[key])),
        duration: (key: string, fallback: number) => (values[key] === undefined ? fallback : Number(values[key])),
        optional: (key: string) => values[key],
    }) as unknown as Parameters<typeof parseAiTasksConfig>[0]

const ENDPOINT = { gatewayUrl: null, virtualKey: null, chatModel: "work", embeddingModel: "embed" }

describe("call limits by kind", () => {
    it("keeps the library's deadline and the model's own reasoning for a task", async () => {
        const policy = await build()

        expect(policy.callLimitsOf({ timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeReasoning: "low" }, "task")).toEqual({
            timeoutMs: 45_000,
        })
    })

    it("gives a node call its own deadline and a bounded reasoning", async () => {
        const policy = await build()

        expect(policy.callLimitsOf({ timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeReasoning: "low" }, "node")).toEqual({
            timeoutMs: 90_000,
            budget: { effort: "low" },
        })
        expect(policy.callLimitsOf({ timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeReasoning: "off" }, "node").budget).toEqual({
            effort: "off",
        })
    })

    it("sends the output limit and the direct reasoning cap of node calls only when the app set them, and no reasoning cap with reasoning off", async () => {
        const policy = await build()
        const options = { timeoutMs: 45_000, nodeReasoning: "low" as const, nodeMaxTokens: 4000, nodeReasoningMaxTokens: 1024 }

        expect(policy.callLimitsOf(options, "node").budget).toEqual({ effort: "low", maxTokens: 4000, reasoningMaxTokens: 1024 })
        expect(policy.callLimitsOf(options, "node", "off").budget).toEqual({ effort: "off", maxTokens: 4000 })
        expect(policy.callLimitsOf({ timeoutMs: 45_000, nodeReasoning: "minimal" }, "node").budget).toEqual({ effort: "minimal" })
        expect(policy.callLimitsOf(options, "task")).toEqual({ timeoutMs: 45_000 })
    })

    it("lets a node name the reasoning of its own call over the default of node calls", async () => {
        const policy = await build()
        const options = { timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeReasoning: "low" as const }

        expect(policy.callLimitsOf(options, "node", "medium").budget).toEqual({ effort: "medium" })
        expect(policy.callLimitsOf(options, "node", "off").budget).toEqual({ effort: "off" })
        expect(policy.callLimitsOf(options, "task", "high")).toEqual({ timeoutMs: 45_000 })
    })

    it("gives a retry of a node call its shorter deadline, and a task the same deadline on every try", async () => {
        const policy = await build()
        const options = { timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeRetryTimeoutMs: 45_000 }

        expect(policy.callLimitsOf(options, "node", undefined, 1).timeoutMs).toBe(90_000)
        expect(policy.callLimitsOf(options, "node", undefined, 2).timeoutMs).toBe(45_000)
        expect(policy.callLimitsOf(options, "node", undefined, 3).timeoutMs).toBe(45_000)
        expect(policy.callLimitsOf(options, "task", undefined, 3).timeoutMs).toBe(45_000)
    })

    it("never lets one try of a node call pass the ceiling, so two tries stay inside the heartbeat of the turn", async () => {
        const policy = await build()
        const limits = policy.callLimitsOf({ timeoutMs: 45_000, nodeTimeoutMs: 900_000, nodeReasoning: "default" }, "node")

        expect(limits).toEqual({ timeoutMs: NODE_TIMEOUT_CEILING_MS })
        // The gateway never cuts an attempt before the caller's own deadline for it.
        expect(NODE_TIMEOUT_CEILING_MS).toBeLessThan(WORK_ATTEMPT_TIMEOUT_MS)
        // The heartbeat renews a running turn's lease for ten minutes (20 beats of 30 s).
        expect(NODE_TIMEOUT_CEILING_MS * 2).toBeLessThan(20 * 30_000)
    })

    it("falls back to the task deadline and the model's default when the node settings are absent", async () => {
        const policy = await build()

        expect(policy.callLimitsOf({ timeoutMs: 45_000 }, "node")).toEqual({ timeoutMs: 45_000 })
    })
})

describe("the upstream routing of node calls", () => {
    const BASE = { timeoutMs: 45_000, nodeTimeoutMs: 90_000, nodeRetryTimeoutMs: 45_000 }

    it("sends no routing unless the app set one, and never for a task", async () => {
        const policy = await build()
        const routed = { ...BASE, nodeRouting: { order: ["wafer"] } }

        expect(policy.callLimitsOf(BASE, "node")).not.toHaveProperty("routing")
        expect(policy.callLimitsOf(routed, "task")).toEqual({ timeoutMs: 45_000 })
        expect(policy.callLimitsOf(routed, "node").routing).toEqual({ order: ["wafer"] })
    })

    it("starts a retry one upstream later in the order, so no two tries of a call ask the same upstream first", async () => {
        const policy = await build()
        const options = { ...BASE, nodeRouting: { order: ["wafer", "together", "digitalocean"], allowFallbacks: true } }

        expect(policy.callLimitsOf(options, "node", undefined, 1).routing).toEqual(options.nodeRouting)
        expect(policy.callLimitsOf(options, "node", undefined, 2).routing).toEqual({
            order: ["together", "digitalocean", "wafer"],
            allowFallbacks: true,
        })
        expect(policy.callLimitsOf(options, "node", undefined, 3).routing?.order).toEqual(["digitalocean", "wafer", "together"])
        // Two upstreams over three tries wrap around; the deadline of each try is untouched.
        const two = { ...BASE, nodeRouting: { order: ["wafer", "together"] } }
        expect([1, 2, 3].map((tryNumber) => policy.callLimitsOf(two, "node", undefined, tryNumber).routing?.order?.[0])).toEqual([
            "wafer",
            "together",
            "wafer",
        ])
        expect(policy.callLimitsOf(options, "node", undefined, 2).timeoutMs).toBe(45_000)
    })

    it("keeps a routing without an order, or with one upstream, the same on every try", async () => {
        const policy = await build()
        const sorted = { ...BASE, nodeRouting: { sort: "throughput" as const } }
        const one = { ...BASE, nodeRouting: { order: ["wafer"] } }

        expect(policy.callLimitsOf(sorted, "node", undefined, 3).routing).toEqual({ sort: "throughput" })
        expect(policy.callLimitsOf(one, "node", undefined, 2).routing).toEqual({ order: ["wafer"] })
    })

    it("reads no routing from an environment that declares none, and never from the fallback flag alone", async () => {
        const policy = await build()

        expect(policy.parseAiTasksConfig(envOf({}), ENDPOINT)).not.toHaveProperty("nodeRouting")
        expect(policy.parseAiTasksConfig(envOf({ AI_NODE_ALLOW_FALLBACKS: "false" }), ENDPOINT)).not.toHaveProperty("nodeRouting")
        expect(
            policy.parseAiTasksConfig(envOf({ AI_NODE_PROVIDER_ORDER: " , ", AI_NODE_PROVIDER_SORT: "fastest" }), ENDPOINT),
        ).not.toHaveProperty("nodeRouting")
    })

    it("reads the declared order, allowlist, sort and fallback flag: slugs trimmed, lower case, each once", async () => {
        const policy = await build()

        expect(
            policy.parseAiTasksConfig(
                envOf({ AI_NODE_PROVIDER_ORDER: " Wafer, together ,wafer,", AI_NODE_ALLOW_FALLBACKS: "TRUE" }),
                ENDPOINT,
            ).nodeRouting,
        ).toEqual({ order: ["wafer", "together"], allowFallbacks: true })
        expect(
            policy.parseAiTasksConfig(
                envOf({ AI_NODE_PROVIDER_ONLY: "wafer,digitalocean", AI_NODE_PROVIDER_SORT: " Throughput ", AI_NODE_ALLOW_FALLBACKS: "0" }),
                ENDPOINT,
            ).nodeRouting,
        ).toEqual({ only: ["wafer", "digitalocean"], sort: "throughput", allowFallbacks: false })
        expect(policy.parseAiTasksConfig(envOf({ AI_NODE_PROVIDER_SORT: "latency", AI_NODE_ALLOW_FALLBACKS: "maybe" }), ENDPOINT).nodeRouting).toEqual({
            sort: "latency",
        })
    })
})

describe("the node call settings of the environment", () => {
    it("defaults a node call to ninety seconds and a low effort", async () => {
        const policy = await build()

        expect(policy.parseAiTasksConfig(envOf({}), ENDPOINT)).toMatchObject({
            timeoutMs: 45_000,
            nodeTimeoutMs: 90_000,
            nodeRetryTimeoutMs: 45_000,
            nodeReasoning: "low",
        })
    })

    it("reads the declared values, caps the deadline at the ceiling and keeps the default for an unknown effort", async () => {
        const policy = await build()

        expect(
            policy.parseAiTasksConfig(envOf({ AI_NODE_TIMEOUT: "600000", AI_NODE_REASONING: " OFF " }), ENDPOINT),
        ).toMatchObject({ nodeTimeoutMs: NODE_TIMEOUT_CEILING_MS, nodeReasoning: "off" })
        expect(policy.parseAiTasksConfig(envOf({ AI_NODE_REASONING: "max" }), ENDPOINT).nodeReasoning).toBe("low")
        expect(policy.parseAiTasksConfig(envOf({ AI_NODE_REASONING: "minimal" }), ENDPOINT).nodeReasoning).toBe("minimal")
    })

    it("sends no cap unless the environment declares a positive whole number", async () => {
        const policy = await build()
        const none = policy.parseAiTasksConfig(envOf({ AI_NODE_MAX_TOKENS: "0", AI_NODE_REASONING_MAX_TOKENS: "abc" }), ENDPOINT)
        const set = policy.parseAiTasksConfig(envOf({ AI_NODE_MAX_TOKENS: "4000", AI_NODE_REASONING_MAX_TOKENS: "1024" }), ENDPOINT)

        expect(none).not.toHaveProperty("nodeMaxTokens")
        expect(none).not.toHaveProperty("nodeReasoningMaxTokens")
        expect(policy.parseAiTasksConfig(envOf({}), ENDPOINT)).not.toHaveProperty("nodeMaxTokens")
        expect(set).toMatchObject({ nodeMaxTokens: 4000, nodeReasoningMaxTokens: 1024 })
    })
})
