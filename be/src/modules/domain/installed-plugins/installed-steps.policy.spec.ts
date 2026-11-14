import { CALL_WORKFLOW_STEP } from "@nivo-lite/agent-sdk/graph"
import { TOOL } from "@nivo-lite/agent-sdk/names"
import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { CONTROL_EFFECTS, INSTALLED, installedStepIn } from "./installed.policy"

const LEGACY: ReadonlyMap<string, NodeDefinition> = new Map(INSTALLED.nodeInstall().nodes.map((node) => [node.id, node]))

describe("the one installed-step view, both forms", () => {
    it("is never asked to choose: no id is both a `defineNode` node and a template node of the installation", () => {
        const templates = new Set(INSTALLED.templateNodes().map((node) => node.id))
        expect(INSTALLED.nodeInstall().nodes.filter((node) => templates.has(node.id)).map((node) => node.id)).toEqual([])
    })

    it("reads a template node: its title, its tools as its calls, whether it holds the customer send, its model and facts", () => {
        const node = INSTALLED.templateNodeOf("sales.consult-turn")
        const step = INSTALLED.stepOf("sales.consult-turn")
        expect(node).not.toBeNull()
        expect(step).toMatchObject({ id: "sales.consult-turn", form: "template", control: false, title: node?.title })
        expect(step?.tools).toEqual([...new Set(node?.tools ?? [])])
        expect(step?.sends).toBe(true)
        expect(step?.model).toBe(node?.model ?? null)
        expect(step?.facts).toEqual(node?.facts ?? {})
        // The same view through a node index (the registry's), whose `defineNode` nodes it reads first.
        expect(installedStepIn(LEGACY, "sales.consult-turn")).toEqual(step)
    })

    it("names, among a template node's calls, the ones that are installed effects", () => {
        const effects: ReadonlySet<string> = new Set(INSTALLED.nodeInstall().effects.map((effect) => effect.id))
        for (const node of INSTALLED.templateNodes()) {
            const step = INSTALLED.stepOf(node.id)
            expect([node.id, step?.effects]).toEqual([node.id, (step?.tools ?? []).filter((tool) => effects.has(tool))])
            expect([node.id, step?.sends]).toEqual([node.id, node.tools.includes(TOOL.customerMessageSend)])
        }
    })

    it("reads a control step as a `defineNode` node of the engine: its effects are its calls, granted by the step itself", () => {
        const step = installedStepIn(LEGACY, CALL_WORKFLOW_STEP)
        expect(step).toMatchObject({ id: CALL_WORKFLOW_STEP, form: "node", control: true, model: null })
        expect(step?.effects).toContain(TOOL.agentTag)
        expect(step?.tools).toEqual(expect.arrayContaining([...(step?.effects ?? [])]))
        expect(step?.sends).toBe(false)
        expect(CONTROL_EFFECTS.has(TOOL.agentTag)).toBe(true)
    })

    it("knows no step for an id neither form declares", () => {
        expect(INSTALLED.stepOf("sales.not-installed")).toBeNull()
        expect(installedStepIn(LEGACY, "sales.not-installed")).toBeNull()
    })
})
