import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts, nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { coreReplyNode } from "./reply.node"
import { hashOf, replyKeyOf } from "./reply.policy"

const [example] = coreReplyNode.examples

describe("core.reply", () => {
    it("holds its example", async () => {
        await expect(nodeExampleMismatches(coreReplyNode, example, coreEffects)).resolves.toEqual([])
    })

    it("sends with a key of the turn and the text, and needs no data right of its own", async () => {
        const fake = fakeNodePorts()
        await runNode(
            {
                node: coreReplyNode,
                params: {},
                input: example.input,
                turn: EXAMPLE_TURN,
                grant: example.grant ?? { rights: [] },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(),
                key: "k",
            },
            fake.ports,
        )
        expect(fake.executed[0]?.dedupeKey).toBe(replyKeyOf("turn-1", example.input.text))
        expect(coreReplyNode.rights).toEqual([])
    })
})

describe("replyKeyOf", () => {
    it("is the same for the same text and differs for another text or turn", () => {
        expect(hashOf("a")).toBe(hashOf("a"))
        expect(hashOf("a")).toMatch(/^[0-9a-f]{8}$/u)
        expect(replyKeyOf("t1", "a")).not.toBe(replyKeyOf("t1", "b"))
        expect(replyKeyOf("t1", "a")).not.toBe(replyKeyOf("t2", "a"))
        expect(replyKeyOf("t1", "a")).toBe(`reply:t1:${hashOf("a")}`)
    })
})
