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
    })
})
