import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import { guidedModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN } from "@nivo-lite/agent-sdk/testing"
import { messageOf, modelWordsOf } from "../messages/catalog"
import { chatbotModule } from "../modules/chatbot/declaration"
import { salesModule } from "../modules/sales/declaration"
import { coreControlNodes, coreTemplateNodes } from "../nodes/node-lists"
import { BRAIN_FACT_FIELDS_POINTER, BRAIN_FACT_LEGEND } from "./brain-fact-legend"
import { TOOL } from "./tool-ids"
import { coreEffects, coreTools } from "./index"
import { brainFactGetTool, brainFactRelatedTool } from "./tools"

// A graph step's model reads blocks-core's tool words, not the gateway's descriptions: the legend of a served truth's compact fields
// (src, v, from/to, now, pub, disputed, next) must be in those words, once, from the one text the gateway uses too.

const FACT_READS = [TOOL.brainFactGet, TOOL.brainFactRelated]

describe("the legend of a served truth", () => {
    it("rides on the truth search's model words, and the other truth reads point at it", () => {
        expect(modelWordsOf("toolBrainSearch")).toBe(`${messageOf("en", "toolBrainSearch")}. ${BRAIN_FACT_LEGEND}`)
        for (const key of ["toolBrainFactGet", "toolBrainFactRelated"] as const) {
            expect(modelWordsOf(key)).toBe(`${messageOf("en", key)}. ${BRAIN_FACT_FIELDS_POINTER}`)
        }
        for (const field of ["src", "v =", "from/to", "now =", "pub", "disputed", "next"])
            expect(BRAIN_FACT_LEGEND).toContain(field)
    })

    it("never reaches a person's words: the title in either language is the plain one", () => {
        for (const locale of ["vi", "en"] as const) expect(messageOf(locale, "toolBrainSearch")).not.toContain("src =")
        expect(modelWordsOf("toolBrainPassageSearch")).toBe(messageOf("en", "toolBrainPassageSearch"))
    })

    it("is in the cached opening (L1) of every agent that reads truths, exactly once", () => {
        for (const module of [salesModule, chatbotModule]) {
            // The set the engine hands every turn: the module's own tools, then the two default sets it adds itself (`withDefaultReads`).
            const agentTools = [...new Set([...(module.agent?.tools ?? []), ...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS])]
            const frame = {
                turn: { ...EXAMPLE_TURN, guidance: "Craft.", agentTools },
                effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
                tools: new Map(coreTools.map((tool) => [tool.id, tool])),
                words: modelWordsOf,
            }
            const request = guidedModelRequest(frame, { purpose: "consult", instructions: "Consult.", input: {} })
            const opening = request.instructions.slice(0, request.sharedLength)
            // The opening lays the tool set out as JSON, so the legend (it quotes a price: `"55.000 d"`) stands in it JSON-escaped: count that form.
            const escaped = JSON.stringify(BRAIN_FACT_LEGEND).slice(1, -1)
            expect(opening.split(escaped).length - 1).toBe(1)
        }
    })

    it("is held wherever a pointer is: every agent and step that holds a truth read holds the truth search", () => {
        const holders = [
            ...[salesModule, chatbotModule].map((module) => module.agent?.tools ?? []),
            ...[...coreControlNodes, ...coreTemplateNodes].map((node) => node.tools ?? []),
        ]
        for (const tools of holders) {
            if (FACT_READS.some((tool) => tools.includes(tool))) expect(tools).toContain(TOOL.brainSearch)
        }
    })

    it("reaches the step as served: a truth read's answer keeps its served fields and passes with a customer's kind-only evidence", () => {
        const served = {
            id: "f1",
            subject: "Shipping fee",
            attribute: "inside the city",
            value: "30.000",
            unit: "VND",
            trust: 95,
            src: { kind: "owner", at: "2026-11-01" },
            v: 2,
            from: "2026-11-01",
            to: null,
            now: "in",
            pub: true,
            disputed: [{ id: "f2", value: "32.000", unit: "VND", now: "wait" }],
        }
        const got = brainFactGetTool.result.safeParse({
            notice: "data",
            fact: { ...served, evidence: [{ kind: "chat" }] },
        })
        expect(got.success).toBe(true)
        expect(got.data?.fact).toMatchObject({
            src: served.src,
            v: 2,
            from: "2026-11-01",
            now: "in",
            pub: true,
            disputed: served.disputed,
        })

        const related = brainFactRelatedTool.result.safeParse({
            notice: "data",
            fact: served,
            related: [{ relation: "applies_to", direction: "out", label: null, fact: served }],
        })
        expect(related.data?.related[0]?.fact).toMatchObject({ src: served.src, v: 2, now: "in" })
    })
})
