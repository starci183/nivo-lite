import { expectedEffects, runExample } from "../node-examples.fixture"
import { coreHandoffNode } from "./handoff.node"
import { tagTextOf } from "./handoff.policy"

describe("core.handoff", () => {
    it.each(coreHandoffNode.examples.map((example) => [example.name, example] as const))(
        "example: %s",
        async (_name, example) => {
            const run = await runExample(coreHandoffNode, example)
            expect(run.output).toEqual(example.output)
            expect(run.effects).toEqual(expectedEffects(example))
        },
    )

    it("tags the turn itself when it has no subject, naming the agent the params set", async () => {
        const [example] = coreHandoffNode.examples
        const run = await runExample(
            coreHandoffNode,
            { ...example, params: { toAgentKey: "billing" } },
            { subject: null },
        )
        expect(run.output).toEqual({ toAgentKey: "billing", tag: { kind: "turn", id: "turn-1" } })
        expect(run.effects[0]?.payload).toMatchObject({ toAgentKey: "billing", subject: undefined })
    })

    it("refuses a target that is empty, and a context that is too large", () => {
        expect(coreHandoffNode.params.safeParse({ toAgentKey: "" }).success).toBe(false)
        const context = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`k${index}`, index]))
        expect(coreHandoffNode.input.safeParse({ text: "x", context }).success).toBe(false)
    })
})

describe("tagTextOf", () => {
    it("adds the context as one JSON line, or leaves the note alone when there is none", () => {
        expect(tagTextOf({ text: "n", context: { a: 1 } })).toBe('n\n{"a":1}')
        expect(tagTextOf({ text: "n", context: {} })).toBe("n")
        expect(tagTextOf({ text: "n", context: null })).toBe("n")
    })
})
