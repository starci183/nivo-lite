import { readFileSync } from "node:fs"
import { join } from "node:path"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "../index"
import { graphSpecProblems } from "./graph-spec.policy"
import { graphSpecSchema } from "./graph-spec.schema"
import type { GraphSpec } from "./graph-spec.types"

const GRAPHS_DIR = join(__dirname, "../../../../.starcistacks/dev/seeds/data/graphs")
const MODULE_KEYS: ReadonlyArray<string> = ["chatbot", "sales", "accounting"]

/**
 * PENDING NODES: steps the graphs name that no lane has landed in coreNodes yet. A graph with a pending node is still checked for its
 * shape and for every node that exists, but not for the minimum of its grant, since the needs of a missing node are not known. When a
 * node lands, this test fails until its id is removed here; when the list is empty every graph is fully judged.
 */
const PENDING_NODE_IDS: ReadonlyArray<string> = ["intent.has", "core.reply"]

const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })

const loaded = (moduleKey: string): GraphSpec =>
    graphSpecSchema.parse(JSON.parse(readFileSync(join(GRAPHS_DIR, `${moduleKey}.json`), "utf8")))

const stepsOf = (spec: GraphSpec): ReadonlyArray<string> => spec.nodes.map((node) => node.step)

describe("agent graph specs of flow F", () => {
    it("names exactly the pending nodes that are not installed", () => {
        const missing = [...new Set(MODULE_KEYS.flatMap((key) => stepsOf(loaded(key))))].filter((step) => !index.nodes.has(step))

        expect([...missing].sort()).toEqual([...PENDING_NODE_IDS].sort())
    })

    it.each(MODULE_KEYS)("%s: is the graph of its own module, woken by a tag from every source", (moduleKey) => {
        const spec = loaded(moduleKey)

        expect(spec.moduleKey).toBe(moduleKey)
        expect(spec.trigger.sources).toHaveLength(5)
    })

    it.each(MODULE_KEYS)("%s: has no problem beyond its pending nodes", (moduleKey) => {
        const problems = graphSpecProblems(loaded(moduleKey), index).filter(
            (problem) => !(problem.code === "NODE_UNKNOWN" && PENDING_NODE_IDS.includes(stepOfKey(loaded(moduleKey), problem.at))),
        )

        expect(problems).toEqual([])
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

const stepOfKey = (spec: GraphSpec, key: string): string => spec.nodes.find((node) => node.key === key)?.step ?? ""
