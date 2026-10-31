import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { runTraceOf, triggerStepOf } from "./run-trace.policy"

/** The members of the subject under test. */
interface Subject {
    readonly runTraceOf: typeof runTraceOf
    readonly triggerStepOf: typeof triggerStepOf
}

const SUBJECT = Symbol("run-trace.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runTraceOf, triggerStepOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const keys = (steps: ReturnType<typeof runTraceOf>): ReadonlyArray<string> => steps.map((step) => step.key)
const BASE = graphOf(OWNER_EXAMPLE)

describe("run-trace.policy triggerStepOf", () => {
    it.each([
        ["customer", "customer_message"],
        ["tag", "tag"],
        ["internal", "event"],
        ["schedule", "schedule"],
        ["other", null],
        [null, null],
    ] as const)("reads a wake from %s as the trigger %s", async (source, trigger) => {
        const subject = await build()

        expect(subject.triggerStepOf(source)).toBe(trigger)
    })
})

describe("run-trace.policy runTraceOf", () => {
    it("walks from the trigger through the condition and the branch it took to an output", async () => {
        const subject = await build()

        const steps = subject.runTraceOf(BASE, {
            action: "pay_supplier",
            branchKey: "middle",
            trigger: "customer_message",
        })

        expect(keys(steps)).toEqual(["start", "decide", "ask", "act", "end"])
        expect(steps.map((step) => step.branchKey)).toEqual([null, "middle", null, null, null])
        expect(steps[0]).toMatchObject({ kind: "trigger", step: "customer_message" })
        expect(steps[1]).toMatchObject({ kind: "condition", step: "evaluate", title: "Check the approval level" })
    })

    it("takes the branch that runs alone straight to the act", async () => {
        const subject = await build()

        expect(keys(subject.runTraceOf(BASE, { action: "pay_supplier", branchKey: "small", trigger: null }))).toEqual([
            "start",
            "decide",
            "act",
            "end",
        ])
    })

    it("starts from the trigger that woke the agent, or the first trigger when the graph has none like it", async () => {
        const subject = await build()
        const tagged = {
            ...BASE,
            nodes: [nodeOf({ key: "tag", kind: "trigger", step: "tag", next: ["decide"] }), ...BASE.nodes],
        }

        expect(
            keys(subject.runTraceOf(tagged, { action: "pay_supplier", branchKey: "small", trigger: "tag" }))[0],
        ).toBe("tag")
        expect(
            keys(subject.runTraceOf(tagged, { action: "pay_supplier", branchKey: "small", trigger: "schedule" }))[0],
        ).toBe("tag")
    })

    it("picks, where a node leads to several, the one that reaches the condition of the action", async () => {
        const subject = await build()
        const forked = {
            ...BASE,
            nodes: BASE.nodes
                .map((node) => (node.key === "start" ? { ...node, next: ["other", "decide"] } : node))
                .concat(nodeOf({ key: "other", kind: "output", step: "write", next: [] })),
        }

        expect(keys(subject.runTraceOf(forked, { action: "pay_supplier", branchKey: "small", trigger: null }))).toEqual(
            ["start", "decide", "act", "end"],
        )
    })

    it("stops at a loop, at a graph with no trigger and at a node that leads nowhere", async () => {
        const subject = await build()
        const loop = {
            ...BASE,
            nodes: BASE.nodes.map((node) => (node.key === "end" ? { ...node, next: ["start"] } : node)),
        }
        const headless = { ...BASE, nodes: BASE.nodes.filter((node) => node.kind !== "trigger") }

        expect(keys(subject.runTraceOf(loop, { action: "pay_supplier", branchKey: "small", trigger: null }))).toEqual([
            "start",
            "decide",
            "act",
            "end",
        ])
        expect(subject.runTraceOf(headless, { action: "pay_supplier", branchKey: "small", trigger: null })).toEqual([])
        expect(keys(subject.runTraceOf(BASE, { action: "unknown_action", branchKey: "small", trigger: null }))[0]).toBe(
            "start",
        )
    })
})
