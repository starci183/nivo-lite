import { runNode } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN, fakeNodePorts } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { salesLeadFromMessageNode } from "./lead-from-message.node"

describe("sales.lead-from-message", () => {
    it("asks once per conversation across runs: the dedupe key is the conversation", async () => {
        const fake = fakeNodePorts()
        const [example] = salesLeadFromMessageNode.examples

        await runNode(
            {
                node: salesLeadFromMessageNode,
                params: example.params,
                input: example.input,
                turn: EXAMPLE_TURN,
                grant: example.grant ?? { rights: [] },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(),
                key: "run:1",
            },
            fake.ports,
        )

        expect(fake.executed.map((effect) => [effect.id, effect.dedupeKey])).toEqual([["lead.ensure", "lead:c1"]])
    })

    it("is a pivot: its effect has no undo, so the saga never takes the customer back", () => {
        const effect = coreEffects.find((each) => each.id === "lead.ensure")

        expect(effect?.compensation).toBeUndefined()
    })
})
