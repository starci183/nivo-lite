import { nodeListMismatches } from "./node-examples"
import {
    lookTool,
    pingEffect,
    probeNode,
    swallowNode,
} from "./probe-nodes"

describe("the probe nodes", () => {
    it("hold every example they promise over the fake ports", async () => {
        await expect(
            nodeListMismatches(
                [probeNode, swallowNode],
                [pingEffect],
                [lookTool],
            ),
        ).resolves.toEqual({})
    })
})
