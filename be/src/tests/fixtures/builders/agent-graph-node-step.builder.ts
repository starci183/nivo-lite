import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { StepJson, StepView } from "@modules/domain/agent-runs"
import { stepViewOf } from "./agent-runs.builder"

/** The fixture of the node step specs: a condition, one output node and the stop, under an empty grant but one tool. */
export const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { rights: [], tools: ["order.look"], effects: [] },
    nodes: [
        { key: "check", kind: "condition", step: "order.check", routes: { yes: "keep" } },
        {
            key: "keep",
            kind: "output",
            step: "order.keep",
            params: { n: 1 },
            input: { id: { $ref: "check.id" }, t: { $ref: "trigger.text" } },
            next: "end",
        },
        { key: "end", kind: "output", step: "stop" },
    ],
}

/** The trigger scope of the fixture run. */
export const TRIGGER: StepJson = {
    text: "hi",
    conversationId: "c-1",
    subject: { kind: "order", id: "o-1" },
    locale: "en",
}

/** A graph node step of the fixture run, at the node named. */
export const stepOf = (nodeKey: string, overrides: Partial<StepView> = {}): StepView =>
    stepViewOf({
        stepKey: nodeKey,
        nodeKey,
        kind: "graph_node",
        input: { versionId: "version-1", nodeKey, trigger: TRIGGER },
        earlier: { check: { output: { branch: "yes", id: "o-9" } } },
        ...overrides,
    })

/** The fixture clock. */
export const NOW: number = Date.parse("2026-11-04T10:00:00.000Z")
/** One day, milliseconds. */
export const DAY_MS: number = 86_400_000
/** The fingerprint of a tool call. */
export const FINGERPRINT: string = "f".repeat(64)
