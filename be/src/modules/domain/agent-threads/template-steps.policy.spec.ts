import { THREAD_END } from "@modules/integrations/langgraph"
import { withTemplateRoutes } from "./template-steps.policy"
import type { CompiledStep, CompiledTemplate } from "./template-compiler.policy"

const stepOf = (key: string, step: string, field: string | null): CompiledStep => ({
    key,
    step,
    kind: field === null ? "execute" : "condition",
    exit:
        field === null
            ? { kind: "next", to: THREAD_END }
            : { kind: "branch", field, routes: { order: "note" }, otherwise: THREAD_END },
    ends: [],
})

const compiled: CompiledTemplate = {
    pin: { versionId: "v", workflowId: null, number: 1, documentHash: null, templateId: null, templateVersion: null },
    entry: "triage",
    nodes: [stepOf("triage", "tmpl.triage", "branch"), stepOf("if", "core.when", "branch"), stepOf("note", "tmpl.order-note", null)],
    freeze: { key: "__freeze", ends: [] },
}

describe("withTemplateRoutes", () => {
    it("routes a template routing node on its own member and leaves every other step as compiled", () => {
        const routed = withTemplateRoutes(compiled, (step) => (step === "tmpl.triage" ? "route" : null))
        expect(routed.nodes[0]?.exit).toEqual({ kind: "branch", field: "route", routes: { order: "note" }, otherwise: THREAD_END })
        expect(routed.nodes[1]).toBe(compiled.nodes[1])
        expect(routed.nodes[2]).toBe(compiled.nodes[2])
    })
})
