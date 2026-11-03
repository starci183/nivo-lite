import { nodeExampleMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreEffects } from "../../vocabulary/effects"
import { intentHasNode } from "./has.node"

describe("intent.has", () => {
    it.each(intentHasNode.examples.map((each) => [each.name, each] as const))("example: %s", async (_name, each) => {
        await expect(nodeExampleMismatches(intentHasNode, each, coreEffects)).resolves.toEqual([])
    })

    it("is a pure condition that routes on yes or no", () => {
        expect(intentHasNode.role).toBe("condition")
        expect(intentHasNode.effects).toEqual([])
        expect(intentHasNode.output.safeParse({ branch: "maybe" }).success).toBe(false)
    })
})
