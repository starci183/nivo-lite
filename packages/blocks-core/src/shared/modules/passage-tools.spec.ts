import { DEFAULT_AI_READ_TOOLS, DEFAULT_NODE_TOOLS } from "@nivo-lite/agent-sdk/names"
import { guidedModelRequest } from "@nivo-lite/agent-sdk/node"
import type { NodeModelRequest } from "@nivo-lite/agent-sdk/node"
import { EXAMPLE_TURN } from "@nivo-lite/agent-sdk/testing"
import { modelWordsOf } from "../messages/catalog"
import { coreTemplateNodes } from "../nodes/node-lists"
import { coreEffects, coreTools } from "../vocabulary"
import { TOOL } from "../vocabulary/tool-ids"
import { toolLabelOf } from "../vocabulary/tool-labels"
import { bookingModule } from "../../agents/booking/declaration"
import { contentModule } from "../../agents/content/declaration"
import { hiringModule } from "../../agents/hiring/declaration"
import { salesModule } from "../../agents/sales/declaration"
import { videoModule } from "../../agents/video/declaration"

// The read-context tools (the truth graph's search / facts / passages / documents, the run's own thread and contact) are held by every AI
// step of every node without being listed (`DEFAULT_AI_READ_TOOLS`): a node lists only the tools that act outside. The document reads
// (`nivo.tool.brain.passage.search` / `.read`) are two of them; the consult turn's examples script the reads it makes
// (`nodes/sales/consult-turn.node.spec.ts`), which the example runner accepts because they are default.

const PASSAGE_TOOLS = [TOOL.brainPassageSearch, TOOL.brainPassageRead]

// The modules whose nodes list no default read tool. A module whose nodes still list one is named in NOT_TRIMMED until its owner trims it;
// the list only shrinks.
const TRIMMED_MODULES = ["video", "content", "booking", "hiring"]
const NOT_TRIMMED = ["chatbot", "sales", "team"]

// The nodes whose OWN code (`context.tools.call`, not an AI step) calls a default read: the SDK grants a node's code only the tools it lists.
const CODE_READS: Readonly<Record<string, ReadonlyArray<string>>> = { "booking.book": [TOOL.conversationMessageList] }

const moduleOf = (nodeId: string): string => nodeId.split(".")[0] ?? ""

describe("the document reads", () => {
    it("are installed tools that only read, with an owner-facing label for the run page", () => {
        for (const id of PASSAGE_TOOLS) {
            const tool = coreTools.find((one) => one.id === id)
            expect(tool?.mutates).toBe(false)
            expect(toolLabelOf(id)?.kind).toBe("reads")
        }
    })

    it("are in the default read set of every AI step, and no installed default read writes", () => {
        expect(DEFAULT_AI_READ_TOOLS).toEqual(expect.arrayContaining([TOOL.brainSearch, ...PASSAGE_TOOLS]))
        for (const id of DEFAULT_AI_READ_TOOLS) {
            const installed = coreTools.find((one) => one.id === id)
            if (installed !== undefined) expect(installed.mutates).toBe(false)
        }
    })

    it("are listed by no node of a trimmed module unless its `requires` names it or its own code calls it", () => {
        const defaults = new Set<string>(DEFAULT_AI_READ_TOOLS)
        const listed = coreTemplateNodes
            .filter((node) => TRIMMED_MODULES.includes(moduleOf(node.id)))
            .flatMap((node) =>
                node.tools
                    .filter(
                        (tool) =>
                            defaults.has(tool) &&
                            !(node.requires ?? []).includes(tool) &&
                            !(CODE_READS[node.id] ?? []).includes(tool),
                    )
                    .map((tool) => `${node.id} lists ${tool}`),
            )
        expect(listed).toEqual([])
    })

    it("are listed, in a module not yet trimmed, only by a node of that module", () => {
        const defaults = new Set<string>(DEFAULT_AI_READ_TOOLS)
        const modules = new Set(TRIMMED_MODULES.concat(NOT_TRIMMED))
        const outside = coreTemplateNodes
            .filter((node) => !modules.has(moduleOf(node.id)) && node.tools.some((tool) => defaults.has(tool)))
            .map((node) => node.id)
        expect(outside).toEqual([])
    })

    it("are in no trimmed module's agent tool set", () => {
        const defaults = new Set<string>(DEFAULT_AI_READ_TOOLS)
        for (const module of [videoModule, contentModule, bookingModule, hiringModule]) {
            expect((module.agent?.tools ?? []).filter((tool) => defaults.has(tool))).toEqual([])
        }
    })

    it("sit in the agent's cached opening (L1), the same bytes on every step", () => {
        // The set the engine hands every turn: the module's own tools, then the two default sets it adds itself (`withDefaultReads`).
        const agentTools = [...new Set([...(salesModule.agent?.tools ?? []), ...DEFAULT_AI_READ_TOOLS, ...DEFAULT_NODE_TOOLS])]
        const turn = { ...EXAMPLE_TURN, guidance: "Craft.", agentTools }
        const frame = {
            turn,
            effects: new Map(coreEffects.map((effect) => [effect.id, effect])),
            tools: new Map(coreTools.map((tool) => [tool.id, tool])),
            words: modelWordsOf,
        }
        const consult = guidedModelRequest(frame, { purpose: "consult", instructions: "Consult.", input: {} })
        const order = guidedModelRequest(frame, { purpose: "order", instructions: "Order.", input: { orderId: "o1" } })
        const opening = (request: NodeModelRequest): string => request.instructions.slice(0, request.sharedLength)

        expect(opening(consult)).toBe(opening(order))
        for (const id of PASSAGE_TOOLS) expect(opening(consult)).toContain(`"name":"${id}"`)
        expect(opening(consult)).toContain(modelWordsOf("toolBrainPassageSearch"))
    })
})
