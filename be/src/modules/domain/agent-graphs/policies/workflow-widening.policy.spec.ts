import { Test } from "@nestjs/testing"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"
import { requireNoWidening, widens } from "./workflow-widening.policy"

const SUBJECT = Symbol("workflow-widening.policy")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { requireNoWidening, widens } }],
    }).compile()
    return moduleRef.get<{ requireNoWidening: typeof requireNoWidening; widens: typeof widens }>(SUBJECT)
}

const graph = (tools: ReadonlyArray<string>): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: {
        tools,
        effects: [],
    },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
})

/** The code a call refused with, or null when it did not refuse. */
const codeOf = (work: () => void): string | null => {
    try {
        work()
        return null
    } catch (cause) {
        return cause instanceof AgentGraphsError ? cause.code : null
    }
}

describe("widens", () => {
    it("is true for a new tool, false for the same or less", async () => {
        const subject = await build()

        expect(subject.widens(graph([]), graph(["nivo.tool.ledger.entry.append"]))).toBe(true)
        expect(subject.widens(graph(["nivo.tool.ledger.entry.append"]), graph([]))).toBe(false)
        expect(subject.widens(graph([]), graph([]))).toBe(false)
    })

    it("is true for a new effect", async () => {
        const subject = await build()
        const withEffect = (effects: ReadonlyArray<string>): GraphSpec => ({
            ...graph([]),
            grant: { ...graph([]).grant, effects },
        })

        expect(subject.widens(withEffect([]), withEffect(["ledger.post"]))).toBe(true)
    })
})

describe("requireNoWidening", () => {
    it("lets the owner widen and refuses a manager", async () => {
        const subject = await build()

        expect(
            codeOf(() => subject.requireNoWidening(graph([]), graph(["nivo.tool.ledger.entry.append"]), "owner")),
        ).toBeNull()
        expect(
            codeOf(() => subject.requireNoWidening(graph([]), graph(["nivo.tool.ledger.entry.append"]), "manager")),
        ).toBe(AgentGraphsErrorCode.WidensNeedsOwner)
        expect(
            codeOf(() => subject.requireNoWidening(graph(["nivo.tool.ledger.entry.append"]), graph([]), "manager")),
        ).toBeNull()
    })
})
