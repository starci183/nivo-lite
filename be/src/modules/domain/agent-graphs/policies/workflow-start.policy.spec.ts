import { runnableOf, workflowInputIssuesOf, workflowInputSchemaOf } from "./workflow-start.policy"

const CONTRACT = {
    inputs: [
        { name: "contactId", type: "string", required: true },
        { name: "count", type: "integer", required: false },
        { name: "amount", type: "number", required: false },
    ],
} as const

const graphOf = (members: Readonly<Record<string, unknown>>): string =>
    JSON.stringify({
        schema: "nivo/agent-graph@1",
        moduleKey: "sales",
        contract: CONTRACT,
        triggers: [{ key: "called", source: { kind: "workflow", connectionId: null } }],
        ...members,
    })

describe("runnableOf: a person may start a workflow only through its own workflow.called trigger", () => {
    it("takes an active workflow that registers workflow.called and is open to any caller, with its declared contract", () => {
        expect(runnableOf(graphOf({}), "active")).toEqual({ runnable: true, contract: CONTRACT })
    })

    it.each<[string, string, string]>([
        ["a workflow that is not active", graphOf({}), "draft"],
        ["a paused workflow", graphOf({}), "paused"],
    ])("refuses %s (not_active)", (_name, graph, status) => {
        expect(runnableOf(graph, status)).toEqual({ runnable: false, refusal: "not_active" })
    })

    it("refuses a workflow whose triggers do not include workflow.called (not_callable)", () => {
        const graph = graphOf({ triggers: [{ key: "zalo", source: { kind: "zalo", connectionId: null } }] })

        expect(runnableOf(graph, "active")).toEqual({ runnable: false, refusal: "not_callable" })
    })

    it("refuses a workflow open only to its own agent's workflows: a person is none of them (agent_only)", () => {
        expect(runnableOf(graphOf({ entry: { openTo: "agent" } }), "active")).toEqual({
            runnable: false,
            refusal: "agent_only",
        })
    })

    it("refuses a graph it cannot read (graph_unreadable)", () => {
        expect(runnableOf("not json", "active")).toEqual({ runnable: false, refusal: "graph_unreadable" })
    })

    it("reads a workflow with no declared contract as taking no input", () => {
        expect(runnableOf(graphOf({ contract: undefined }), "active")).toEqual({
            runnable: true,
            contract: { inputs: [] },
        })
    })
})

describe("workflowInputSchemaOf: the JSON Schema of the declared input contract", () => {
    it("names every input with its JSON type, the required ones required, nothing else accepted", () => {
        expect(workflowInputSchemaOf(CONTRACT)).toEqual({
            type: "object",
            properties: { contactId: { type: "string" }, count: { type: "integer" }, amount: { type: "number" } },
            required: ["contactId"],
            additionalProperties: false,
        })
    })
})

describe("workflowInputIssuesOf: the inputs a run is given, judged against the declared contract", () => {
    it("takes inputs that fit (an integer fills a number)", () => {
        expect(workflowInputIssuesOf(CONTRACT, { contactId: "c-1", count: 2, amount: 3 })).toEqual([])
    })

    it("names a missing required input, an undeclared one and one of another type", () => {
        expect(workflowInputIssuesOf(CONTRACT, { count: 1.5, extra: true })).toEqual([
            { at: "contactId", code: "required" },
            { at: "count", code: "type" },
            { at: "extra", code: "unknown" },
        ])
    })

    it("reads a null optional input as not given, and a null required one as missing", () => {
        expect(workflowInputIssuesOf(CONTRACT, { contactId: null, count: null })).toEqual([
            { at: "contactId", code: "required" },
        ])
    })
})
