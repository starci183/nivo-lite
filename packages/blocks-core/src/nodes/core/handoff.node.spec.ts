import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { coreHandoffNode } from "./handoff.node"
import { tagTextOf } from "./handoff.policy"

const [example] = coreHandoffNode.examples

describe("core.handoff", () => {
    it.each(coreHandoffNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreHandoffNode, each, coreEffects)).resolves.toEqual([])
    })

    it("names the agent the params set, not one of its own", async () => {
        const changed = {
            ...example,
            params: { toAgentKey: "billing" },
            effects: [
                {
                    kind: "agent.tag" as const,
                    payload: {
                        toModuleKey: "billing",
                        text: 'Khách muốn đặt 1 chậu hoa\n{"intent":"order","address":"69 Hàng Xanh"}',
                        conversationId: "c1",
                    },
                },
            ],
            output: { toAgentKey: "billing", tag: { kind: "agent.tag", id: "agent.tag-1" } },
        }
        await expect(nodeExampleMismatches(coreHandoffNode, changed, coreEffects)).resolves.toEqual([])
    })

    it("carries the subject of the turn in the tag", async () => {
        const fake = fakeNodePorts()
        await runNode(
            {
                node: coreHandoffNode,
                params: example.params,
                input: example.input,
                turn: { ...EXAMPLE_TURN, subject: { kind: "conversation", id: "c1" } },
                grant: { rights: [] },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                key: "k",
            },
            fake.ports,
        )
        expect(fake.executed[0]?.payload).toMatchObject({ subject: { kind: "conversation", id: "c1" } })
    })

    it("refuses a target that is empty, and a context that is too large", () => {
        expect(coreHandoffNode.params.safeParse({ toAgentKey: "" }).success).toBe(false)
        const context = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`k${index}`, index]))
        expect(coreHandoffNode.input.safeParse({ text: "x", conversationId: null, context }).success).toBe(false)
    })
})

describe("tagTextOf", () => {
    it("adds the context as one JSON line, or leaves the note alone when there is none", () => {
        expect(tagTextOf({ text: "n", conversationId: null, context: { a: 1 } })).toBe('n\n{"a":1}')
        expect(tagTextOf({ text: "n", conversationId: null, context: {} })).toBe("n")
        expect(tagTextOf({ text: "n", conversationId: null, context: null })).toBe("n")
    })
})
