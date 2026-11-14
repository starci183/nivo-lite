import { coreControlNodes, coreTemplateNodes } from "../nodes/node-lists"
import { AUTO_MODEL, SONNET_MODEL, isModelChoice } from "@nivo-lite/agent-sdk/models"
import {
    ALL_NODES_ON_CLAUDE,
    ENGINE_CORE_MODEL,
    NODE_MODELS,
    nodeModelOf,
    nodeModelsUnder,
} from "./node-models"

/** The installed steps that call AI: a template node declares its model exactly when it calls the agent (ruling B7); no control step does. */
const AI_NODES: ReadonlyArray<string> = coreTemplateNodes.filter((node) => node.model !== undefined).map((node) => node.id)

const installed: ReadonlySet<string> = new Set<string>([...coreControlNodes, ...coreTemplateNodes].map((node) => node.id))

describe("the table of node models", () => {
    it("has a row for every installed node that calls AI", () => {
        const missing = AI_NODES.filter((id) => nodeModelOf(id) === null)

        expect(missing).toEqual([])
    })

    it("names only installed nodes that call AI, each with a choice of the vocabulary", () => {
        const wrong = Object.entries(NODE_MODELS)
            .filter(([id, row]) => {
                return !installed.has(id) || !AI_NODES.includes(id) || !isModelChoice(row.model)
            })
            .map(([id]) => id)

        expect(wrong).toEqual([])
        expect(isModelChoice(ENGINE_CORE_MODEL.model)).toBe(true)
    })

    it("declares classification light", () => {
        expect(nodeModelOf("chatbot.complaint-reply")?.weight).toBe("light")
        expect(nodeModelOf("chatbot.understand")?.weight).toBe("light")
        expect(nodeModelOf("core.if")).toBeNull()
    })
})

describe("the temporary all-nodes-on-Claude switch", () => {
    const weights = (table: Readonly<Record<string, { readonly weight: string }>>): Record<string, string> =>
        Object.fromEntries(Object.entries(table).map(([id, row]) => [id, row.weight]))

    it("on: every row declares Claude Sonnet 5.5, with its weight kept", () => {
        const on = nodeModelsUnder(true)

        expect(Object.values(on).every((row) => row.model === SONNET_MODEL)).toBe(true)
        expect(weights(on)).toEqual(weights(nodeModelsUnder(false)))
    })

    it("off: every row declares Auto, the table as written", () => {
        expect(Object.values(nodeModelsUnder(false)).every((row) => row.model === AUTO_MODEL)).toBe(true)
    })

    it("keeps a row for every AI node in both positions", () => {
        const aiNodes = [...AI_NODES].sort()

        expect(Object.keys(nodeModelsUnder(true)).sort()).toEqual(aiNodes)
        expect(Object.keys(nodeModelsUnder(false)).sort()).toEqual(aiNodes)
    })

    it("the exported table and the engine core follow the switch's current position", () => {
        const expected = ALL_NODES_ON_CLAUDE ? SONNET_MODEL : AUTO_MODEL

        expect(NODE_MODELS).toEqual(nodeModelsUnder(ALL_NODES_ON_CLAUDE))
        expect(ENGINE_CORE_MODEL).toEqual({ model: expected, weight: "heavy" })
    })
})

describe("models on graphs", () => {
    it("gives every AI template node a model of the vocabulary, its own (the node carries it into every graph that places it)", () => {
        for (const node of coreTemplateNodes) {
            if (node.model !== undefined) expect([node.id, isModelChoice(node.model)]).toEqual([node.id, true])
        }
    })

})
