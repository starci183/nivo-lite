import { readFileSync } from "node:fs"
import { join } from "node:path"
import { STOP_STEP, graphSpecProblems, graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "./index"

const GRAPHS_DIR = join(__dirname, "../../../.starcistacks/dev/seeds/data/graphs")
const MODULE_KEYS: ReadonlyArray<string> = ["chatbot", "sales", "accounting"]

const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })

const loaded = (moduleKey: string): GraphSpec =>
    graphSpecSchema.parse(JSON.parse(readFileSync(join(GRAPHS_DIR, `${moduleKey}.json`), "utf8")))

const stepsOf = (spec: GraphSpec): ReadonlyArray<string> => spec.nodes.map((node) => node.step)

describe("agent graph specs of flow F", () => {
    it("names only installed nodes (the built-in `stop` apart)", () => {
        const missing = [...new Set(MODULE_KEYS.flatMap((key) => stepsOf(loaded(key))))].filter((step) => step !== STOP_STEP && !index.nodes.has(step))

        expect(missing).toEqual([])
    })

    it.each(MODULE_KEYS)("%s: is the graph of its own module, woken by a tag from every source", (moduleKey) => {
        const spec = loaded(moduleKey)

        expect(spec.moduleKey).toBe(moduleKey)
        expect(spec.trigger.sources).toHaveLength(5)
    })

    it.each(MODULE_KEYS)("%s: has no problem, and its grant is the minimum its nodes need", (moduleKey) => {
        expect(graphSpecProblems(loaded(moduleKey), index)).toEqual([])
    })

    it("refuses a graph whose branch has no route, whose grant is short or whose reference is not upstream", () => {
        const sales = loaded("sales")
        const broken: GraphSpec = {
            ...sales,
            grant: { ...sales.grant, tools: [], effects: [...sales.grant.effects, "agent.tag"] },
            nodes: sales.nodes.map((node) =>
                node.key === "needs-approval" ? { ...node, routes: { "approve-self": "confirm" } } : node,
            ),
        }

        expect(graphSpecProblems(broken, index).map((problem) => problem.code)).toEqual(
            expect.arrayContaining(["NODE_ROUTE_MISSING", "NODE_RIGHTS_UNGRANTED", "GRAPH_GRANT_EXCESS", "GRAPH_TOOLS_MISMATCH"]),
        )
    })
})
