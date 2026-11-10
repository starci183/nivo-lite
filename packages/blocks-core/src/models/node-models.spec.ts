import { coreNodes } from "../nodes/core-nodes"
import { WORKFLOW_TEMPLATES } from "../modules/workflow-templates"
import {
    AUTO_MODEL,
    SONNET_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    CHEAP_MODEL,
    DEEPSEEK_MODEL,
    DEFAULT_MODEL,
    HAIKU_MODEL,
    MODEL_ENTRIES,
    MODEL_IDS,
    STRONGER_MODEL,
    isModelChoice,
    isModelId,
    isRetiredModel,
    modelEntryOf,
} from "./models"
import {
    ALL_NODES_ON_CLAUDE,
    ENGINE_CORE_MODEL,
    NODE_MODELS,
    graphModelProblems,
    nodeModelOf,
    nodeModelsUnder,
    withDeclaredModels,
} from "./node-models"

/** A node calls AI when one of its examples scripts the model's answers: the runner then asks the model on that path. */
const callsAi = (node: (typeof coreNodes)[number]): boolean =>
    (node.examples ?? []).some((example) => Array.isArray(example.model) && example.model.length > 0)

const installed: ReadonlySet<string> = new Set<string>(coreNodes.map((node) => node.id))

describe("the model vocabulary", () => {
    it("offers Auto first, then every explicit model once, each labelled in both languages", () => {
        expect(MODEL_ENTRIES.map((entry) => entry.id)).toEqual([AUTO_MODEL, ...MODEL_IDS])
        for (const entry of MODEL_ENTRIES) {
            expect(entry.label.vi.length).toBeGreaterThan(0)
            expect(entry.label.en.length).toBeGreaterThan(0)
            expect(entry.hint.vi.length).toBeGreaterThan(0)
            expect(entry.hint.en.length).toBeGreaterThan(0)
            expect(entry.provider === null).toBe(entry.id === AUTO_MODEL)
        }
    })

    it("defaults to Claude Sonnet 5.5 and maps Auto's weights onto models of the vocabulary", () => {
        expect(DEFAULT_MODEL).toBe("claude-sonnet-5-5")
        expect(AUTO_MODEL_OF_WEIGHT).toEqual({ light: "claude-haiku-5-5", heavy: "claude-sonnet-5-5" })
        expect(isModelId(STRONGER_MODEL)).toBe(true)
        expect(modelEntryOf(DEFAULT_MODEL)?.provider).toBe("anthropic")
    })

    it("offers only Claude (owner: no OpenRouter): Auto, Sonnet 5.5, Haiku 5.5; the cheap tier is Haiku", () => {
        expect(MODEL_ENTRIES.filter((entry) => entry.selectable).map((entry) => entry.id)).toEqual([
            "auto",
            "claude-sonnet-5-5",
            "claude-haiku-5-5",
        ])
        expect(CHEAP_MODEL).toBe(HAIKU_MODEL)
        expect(MODEL_ENTRIES.every((entry) => entry.provider === null || entry.provider === "anthropic")).toBe(true)
    })

    it("keeps DeepSeek flash as a retired id: read with its label, never a choice, refused on a saved graph", () => {
        expect(isRetiredModel(DEEPSEEK_MODEL)).toBe(true)
        expect(isModelChoice(DEEPSEEK_MODEL)).toBe(false)
        expect(isModelId(DEEPSEEK_MODEL)).toBe(false)
        expect(modelEntryOf(DEEPSEEK_MODEL)?.selectable).toBe(false)
        expect(modelEntryOf(DEEPSEEK_MODEL)?.provider).toBe("openrouter")
        expect(
            graphModelProblems({ nodes: [{ key: "n1", kind: "execute", step: "chatbot.answer", model: DEEPSEEK_MODEL }] as never }),
        ).toEqual([{ code: "MODEL_RETIRED", nodeKey: "n1" }])
    })

    it("accepts Auto and the explicit ids, and nothing else", () => {
        expect(isModelChoice("auto")).toBe(true)
        expect(isModelChoice("claude-sonnet-5-5")).toBe(true)
        expect(isModelChoice("gpt-4o")).toBe(false)
        expect(isModelChoice(undefined)).toBe(false)
        expect(isModelId("auto")).toBe(false)
    })
})

describe("the table of node models", () => {
    it("has a row for every installed node that calls AI", () => {
        const missing = coreNodes.filter((node) => callsAi(node) && nodeModelOf(node.id) === null).map((node) => node.id)

        expect(missing).toEqual([])
    })

    it("names only installed nodes that call AI, each with a choice of the vocabulary", () => {
        const wrong = Object.entries(NODE_MODELS)
            .filter(([id, row]) => {
                const node = coreNodes.find((one) => one.id === id)
                return node === undefined || !callsAi(node) || !isModelChoice(row.model)
            })
            .map(([id]) => id)

        expect(wrong).toEqual([])
        expect(isModelChoice(ENGINE_CORE_MODEL.model)).toBe(true)
    })

    it("declares the money steps heavy and classification light", () => {
        expect(nodeModelOf("accounting.match-payment")?.weight).toBe("heavy")
        expect(nodeModelOf("payment.settle")?.weight).toBe("heavy")
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
        const aiNodes = coreNodes.filter(callsAi).map((node) => node.id).sort()

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
    it("writes the declared model on every AI node of every template version, and on no other node", () => {
        for (const template of WORKFLOW_TEMPLATES) {
            for (const version of template.versions) {
                for (const node of version.graph.nodes) {
                    const declared = installed.has(node.step) ? nodeModelOf(node.step) : null
                    expect([template.id, node.key, node.model]).toEqual([template.id, node.key, declared?.model])
                }
                expect(graphModelProblems(version.graph)).toEqual([])
            }
        }
    })

    it("keeps a model the graph already names", () => {
        const graph = withDeclaredModels({
            nodes: [{ key: "match", kind: "execute", step: "accounting.match-payment", model: "deepseek/deepseek-v4.1-flash" }],
        })

        expect(graph.nodes[0]?.model).toBe("deepseek/deepseek-v4.1-flash")
    })

    it("refuses an unknown model and a model on a node that calls no AI", () => {
        expect(
            graphModelProblems({
                nodes: [
                    { key: "a", kind: "execute", step: "accounting.match-payment", model: "gpt-4o" },
                    { key: "b", kind: "condition", step: "core.if", model: "auto" },
                    { key: "c", kind: "condition", step: "chatbot.understand", model: "auto" },
                ],
            }),
        ).toEqual([
            { code: "MODEL_UNKNOWN", nodeKey: "a" },
            { code: "MODEL_ON_NODE_WITHOUT_AI", nodeKey: "b" },
        ])
    })
})
