import { nodeListProblems } from "@nivo-lite/agent-sdk/node"
import { nodeListMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "./index"

describe("core nodes conformance", () => {
    it("installs every node, effect, tool and data kind without a problem", () => {
        expect(nodeListProblems({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })).toEqual(
            [],
        )
    })

    it("runs every worked example of every node as it promises", async () => {
        await expect(nodeListMismatches(coreNodes, coreEffects, coreTools)).resolves.toEqual({})
    })
})
