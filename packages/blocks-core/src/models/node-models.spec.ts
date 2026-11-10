import { coreNodes } from "../nodes/core-nodes"
import { WORKFLOW_TEMPLATES } from "../modules/workflow-templates"
import {
    AUTO_MODEL,
    AUTO_MODEL_OF_WEIGHT,
    DEFAULT_MODEL,
    MODEL_ENTRIES,
    MODEL_IDS,
    STRONGER_MODEL,
    isModelChoice,
    isModelId,
    modelEntryOf,
} from "./models"
import { ENGINE_CORE_MODEL, NODE_MODELS, graphModelProblems, nodeModelOf, withDeclaredModels } from "./node-models"

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
        expect(AUTO_MODEL_OF_WEIGHT).toEqual({ light: "deepseek/deepseek-v4.1-flash", heavy: "claude-sonnet-5-5" })
        expect(isModelId(STRONGER_MODEL)).toBe(true)
        expect(modelEntryOf(DEFAULT_MODEL)?.provider).toBe("anthropic")
        expect(modelEntryOf("deepseek/deepseek-v4.1-flash")?.provider).toBe("openrouter")
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
