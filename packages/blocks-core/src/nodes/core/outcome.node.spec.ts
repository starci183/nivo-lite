import { OUTCOME_STEP, runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { coreOutcomeNode } from "./outcome.node"

const end = async (outcome: string, outputs: Record<string, unknown>) => {
    const fake = fakeNodePorts()
    const run = await runNode(
        {
            node: coreOutcomeNode,
            params: { outcome },
            input: { outputs },
            turn: EXAMPLE_TURN,
            grant: { rights: [] },
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(),
            key: "k",
        },
        fake.ports,
    )
    return { run, executed: fake.executed }
}

describe("core.outcome", () => {
    it("is the outcome step of the contract and touches nothing", () => {
        expect(coreOutcomeNode.id).toBe(OUTCOME_STEP)
        expect(coreOutcomeNode.effects).toEqual([])
        expect(coreOutcomeNode.rights).toEqual([])
    })

    it.each(coreOutcomeNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreOutcomeNode, each, coreEffects)).resolves.toEqual([])
    })

    it("echoes the outputs under the outcome, nested values as they are", async () => {
        const outputs = { leadId: "l1", items: [{ name: "Hoa h\u1ed3ng", quantity: 2 }], address: null }
        const { run, executed } = await end("buying", outputs)

        expect(run.output).toEqual({ outcome: "buying", values: outputs })
        expect(executed).toEqual([])
    })

    it("answers an outcome with no outputs", async () => {
        expect((await end("answered", {})).run.output).toEqual({ outcome: "answered", values: {} })
    })

    it("hands on a copy, so what the next steps read as out.<name> is its own", async () => {
        const outputs = { a: 1 }
        const { run } = await end("won", outputs)

        expect(coreOutcomeNode.output.parse(run.output).values).not.toBe(outputs)
    })

    it("refuses an empty outcome key", () => {
        expect(coreOutcomeNode.params.safeParse({ outcome: "" }).success).toBe(false)
        expect(coreOutcomeNode.params.safeParse({}).success).toBe(false)
    })
})
