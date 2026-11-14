import { nodeListProblems } from "@nivo-lite/agent-sdk/node"
import { nodeListMismatches, templateNodeListMismatches } from "@nivo-lite/agent-sdk/testing"
import { coreControlNodes, coreDataKinds, coreEffects, corePlugin, coreTemplateNodes, coreTools } from "./index"

describe("core nodes conformance", () => {
    it("installs every control node, effect, tool and data kind without a problem", () => {
        expect(
            nodeListProblems({ nodes: coreControlNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds }),
        ).toEqual([])
    })

    it("runs every worked example of every control node as it promises", async () => {
        await expect(nodeListMismatches(coreControlNodes, coreEffects, coreTools)).resolves.toEqual({})
    })

    it("runs every worked example of every template node as it promises", async () => {
        await expect(templateNodeListMismatches(coreTemplateNodes)).resolves.toEqual({})
    })

    it("lists exactly the template nodes its agents' graphs place, each definition once", () => {
        const placed = new Set((corePlugin.templateAgents ?? []).flatMap((agent) => agent.graphs.flatMap((graph) => [...graph.nodes.values()])))

        expect(new Set(coreTemplateNodes)).toEqual(placed)
        expect(new Set(coreTemplateNodes.map((node) => node.id)).size).toBe(coreTemplateNodes.length)
    })
})
