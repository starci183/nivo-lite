import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { coreHandoffNode } from "./handoff.node"
import { tagPayloadOf } from "./handoff.policy"

const [example] = coreHandoffNode.examples
const BARE = { text: "n", leadId: null, channel: null, conversationId: null, context: null }

describe("core.handoff", () => {
    it.each(coreHandoffNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(coreHandoffNode, each, coreEffects)).resolves.toEqual([])
    })

    it("tags the module the params name, not one of its own", async () => {
        const [first] = coreHandoffNode.examples
        const changed = {
            ...first,
            params: { toModuleKey: "billing" },
            effects: first.effects.map((effect) =>
                typeof effect === "string"
                    ? effect
                    : { ...effect, payload: { ...effect.payload, toModuleKey: "billing" } },
            ),
            output: { toModuleKey: "billing", tag: { kind: "agent.tag", id: "agent.tag-1" } },
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
                tools: new Map(),
                key: "k",
            },
            fake.ports,
        )
        expect(fake.executed[0]?.payload).toMatchObject({ subject: { kind: "conversation", id: "c1" } })
    })

    it("refuses a context that is not plain data or is too long, and a target that is empty", () => {
        expect(coreHandoffNode.input.safeParse({ ...BARE, context: { when: new Date(0) } }).success).toBe(false)
        const long = Object.fromEntries(["a", "b", "c", "d", "e"].map((key) => [key, key.repeat(1900)]))
        expect(coreHandoffNode.input.safeParse({ ...BARE, context: long }).success).toBe(false)
        const many = Object.fromEntries(Array.from({ length: 41 }, (_, index) => [`k${index}`, index]))
        expect(coreHandoffNode.input.safeParse({ ...BARE, context: many }).success).toBe(false)
        expect(coreHandoffNode.params.safeParse({ toModuleKey: "" }).success).toBe(false)
    })
})

describe("tagPayloadOf", () => {
    it("keeps the note as text and sends the context, nested order included, in the context field", () => {
        const context = { intents: ["order"], order: { items: [{ name: "chậu hoa", quantity: 1 }], address: null } }
        expect(tagPayloadOf("sales", { ...BARE, context }, null)).toEqual({ toModuleKey: "sales", text: "n", context })
    })

    it("leaves out what is not bound: an empty context, no lead, channel or conversation, no subject", () => {
        expect(tagPayloadOf("sales", { ...BARE, context: {} }, null)).toEqual({ toModuleKey: "sales", text: "n" })
    })

    it("passes the lead, channel, conversation and subject through when bound", () => {
        expect(
            tagPayloadOf(
                "sales",
                { ...BARE, leadId: "l1", channel: "zalo", conversationId: "c1" },
                { kind: "conversation", id: "c1" },
            ),
        ).toEqual({
            toModuleKey: "sales",
            text: "n",
            leadId: "l1",
            channel: "zalo",
            conversationId: "c1",
            subject: { kind: "conversation", id: "c1" },
        })
    })
})
