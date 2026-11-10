import { STOP_STEP, wakesOfTriggers, graphRefProblems, graphSpecProblems, graphSpecSchema, specRefContextOf } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import accounting from "../../../.starcistacks/dev/seeds/data/graphs/accounting.json"
import chatbot from "../../../.starcistacks/dev/seeds/data/graphs/chatbot.json"
import sales from "../../../.starcistacks/dev/seeds/data/graphs/sales.json"
import { coreDataKinds, coreEffects, coreNodes, coreTools } from "./index"

const SEEDS: Readonly<Record<string, unknown>> = { chatbot, sales, accounting }
const MODULE_KEYS: ReadonlyArray<string> = ["chatbot", "sales", "accounting"]

const index = nodeIndexOf({ nodes: coreNodes, effects: coreEffects, tools: coreTools, dataKinds: coreDataKinds })

const loaded = (moduleKey: string): GraphSpec => graphSpecSchema.parse(SEEDS[moduleKey])

const stepsOf = (spec: GraphSpec): ReadonlyArray<string> => spec.nodes.map((node) => node.step)

describe("agent graph specs of flow F", () => {
    it("names only installed nodes (the built-in `stop` apart)", () => {
        const missing = [...new Set(MODULE_KEYS.flatMap((key) => stepsOf(loaded(key))))].filter(
            (step) => step !== STOP_STEP && !index.nodes.has(step),
        )

        expect(missing).toEqual([])
    })

    it.each(MODULE_KEYS)("%s: is the graph of its own module, woken only by the wakes of its typed triggers", (moduleKey) => {
        const spec = loaded(moduleKey)

        expect(spec.moduleKey).toBe(moduleKey)
        expect(spec.triggers?.length ?? 0).toBeGreaterThan(0)
        expect(spec.trigger.sources).toEqual(wakesOfTriggers(spec.triggers ?? []))
        expect(spec.contract?.inputs.length ?? 0).toBeGreaterThan(0)
    })

    it.each(MODULE_KEYS)("%s: has no problem, and its grant is the minimum its nodes need", (moduleKey) => {
        expect(graphSpecProblems(loaded(moduleKey), index)).toEqual([])
    })

    it.each(MODULE_KEYS)("%s: has no broken param or ref, as a new version is judged at save", (moduleKey) => {
        const spec = loaded(moduleKey)
        expect(graphRefProblems(spec, specRefContextOf(spec, index)).map((problem) => `${problem.code} ${problem.nodeKey}.${problem.field} ${problem.ref ?? ""}`)).toEqual([])
    })

    it("refuses a graph whose branch has no route, whose grant is short or whose reference is not upstream", () => {
        const chatbot = loaded("chatbot")
        const ledger = loaded("accounting").nodes.find((node) => node.step === "accounting.post-payment")
        if (ledger === undefined) throw new Error("the accounting seed has no ledger step")
        const broken: GraphSpec = {
            ...chatbot,
            // No right granted, an effect no node uses, and no tool for the ledger step the graph now reaches.
            grant: { rights: [], tools: [], effects: [...chatbot.grant.effects, "lead.ensure"] },
            nodes: [
                ...chatbot.nodes.map((node) =>
                    node.kind === "condition" ? { ...node, routes: {} } : node.key === "answer" ? { ...node, next: ledger.key } : node,
                ),
                ledger,
            ],
        }

        expect(graphSpecProblems(broken, index).map((problem) => problem.code)).toEqual(
            expect.arrayContaining([
                "NODE_ROUTE_MISSING",
                "NODE_RIGHTS_UNGRANTED",
                "GRAPH_GRANT_EXCESS",
                "GRAPH_TOOLS_MISMATCH",
            ]),
        )
    })
})
