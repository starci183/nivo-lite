import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode, WorkflowContract } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import * as policy from "./workflow-calls.policy"
import type { CallableWorkflow, CallingWorkflow } from "./workflow-calls.policy"

const SUBJECT = Symbol("workflow-calls.policy")

/** The policy, bound as a kit double over its real functions. */
const policyDouble = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policyDouble }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

const graphOf = (extra: Partial<GraphSpec> = {}): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [],
    ...extra,
})

const contractOf = (...inputs: WorkflowContract["inputs"]): WorkflowContract => ({ inputs })

const CONSULT_CONTRACT = contractOf(
    { name: "leadId", type: "string", required: true },
    { name: "text", type: "string", required: true },
    { name: "items", type: "array", required: false },
)

const callable = (over: Partial<CallableWorkflow> = {}): CallableWorkflow => ({
    agentId: "agent-sales",
    moduleKey: "sales",
    key: "consult",
    running: graphOf({ contract: CONSULT_CONTRACT }),
    versions: new Map(),
    ...over,
})

const callNode = (inputs: JsonValue | undefined, over: Record<string, JsonValue> = {}): GraphSpecNode => ({
    key: "hand",
    kind: "execute",
    step: "core.call-workflow",
    params: {
        agent: "sales",
        workflow: "consult",
        version: "latest",
        ...(inputs === undefined ? {} : { inputs }),
        ...over,
    },
})

const COVERING = { leadId: { $ref: "trigger.leadId" }, text: { $ref: "trigger.text" } }

const SAVER = { agentId: "agent-chatbot", moduleKey: "chatbot", key: "front-desk" }

describe("callContractProblems: the target", () => {
    it("finds no problem in a hand-off that covers the target's contract, and none in a graph with no hand-off", async () => {
        const subject = await buildPolicy()
        const sound = graphOf({ nodes: [callNode(COVERING)] })
        const plain = graphOf({ nodes: [{ key: "a", kind: "execute", step: "sales.consult" }] })

        expect(subject.callContractProblems(SAVER, sound, [callable()])).toEqual([])
        expect(subject.callContractProblems(SAVER, plain, [])).toEqual([])
    })

    it("refuses a call to a workflow the workspace does not have, in another module or under another key", async () => {
        const subject = await buildPolicy()
        const graph = graphOf({ nodes: [callNode(COVERING)] })

        expect(subject.callContractProblems(SAVER, graph, [])).toEqual([{ code: "CALL_TARGET_UNKNOWN", at: "hand" }])
        expect(subject.callContractProblems(SAVER, graph, [callable({ key: "other" })])).toEqual([
            { code: "CALL_TARGET_UNKNOWN", at: "hand" },
        ])
        expect(subject.callContractProblems(SAVER, graph, [callable({ moduleKey: "accounting" })])).toEqual([
            { code: "CALL_TARGET_UNKNOWN", at: "hand" },
        ])
    })

    it("refuses a pinned version the target does not have, and checks a pin against that version's contract", async () => {
        const subject = await buildPolicy()
        const old = graphOf({ contract: contractOf({ name: "leadId", type: "string", required: true }) })
        const target = callable({ versions: new Map([[1, old]]) })

        expect(
            subject.callContractProblems(SAVER, graphOf({ nodes: [callNode(COVERING, { version: 9 })] }), [target]),
        ).toEqual([{ code: "CALL_VERSION_UNKNOWN", at: "hand" }])
        expect(
            subject.callContractProblems(SAVER, graphOf({ nodes: [callNode({ leadId: "l-1" }, { version: 1 })] }), [
                target,
            ]),
        ).toEqual([])
        expect(
            subject.callContractProblems(SAVER, graphOf({ nodes: [callNode(COVERING, { version: 1 })] }), [target]),
        ).toEqual([{ code: "CALL_INPUT_UNKNOWN", at: "hand.text" }])
    })

    it("treats a version that is not a number as latest", async () => {
        const subject = await buildPolicy()
        const graph = graphOf({ nodes: [callNode(COVERING, { version: "newest" })] })

        expect(subject.callContractProblems(SAVER, graph, [callable()])).toEqual([])
    })

    it("refuses another agent a workflow open to its own agent only, and lets the owning agent in", async () => {
        const subject = await buildPolicy()
        const closed = callable({ running: graphOf({ contract: CONSULT_CONTRACT, entry: { openTo: "agent" } }) })
        const graph = graphOf({ nodes: [callNode(COVERING)] })

        expect(subject.callContractProblems(SAVER, graph, [closed])).toEqual([
            { code: "CALL_ENTRY_CLOSED", at: "hand" },
        ])
        expect(subject.callContractProblems({ ...SAVER, agentId: "agent-sales" }, graph, [closed])).toEqual([])
    })

    it("prefers the candidate on the saver's own agent among the agents of one module", async () => {
        const subject = await buildPolicy()
        const strangers = callable({ agentId: "agent-sales-2", running: graphOf({ contract: contractOf() }) })
        const own = callable({ agentId: "agent-chatbot" })
        const graph = graphOf({ nodes: [callNode(COVERING)] })

        expect(subject.callContractProblems(SAVER, graph, [strangers, own])).toEqual([])
        expect(subject.callContractProblems(SAVER, graph, [strangers])).toEqual([
            { code: "CALL_INPUT_UNKNOWN", at: "hand.leadId" },
            { code: "CALL_INPUT_UNKNOWN", at: "hand.text" },
        ])
    })
})

describe("callContractProblems: the inputs", () => {
    it("refuses a missing required input, an input the target lacks and a mistyped one", async () => {
        const subject = await buildPolicy()
        const missing = graphOf({ nodes: [callNode({ leadId: { $ref: "trigger.leadId" } })] })
        const unknown = graphOf({ nodes: [callNode({ ...COVERING, color: "red" })] })
        const mistyped = graphOf({ nodes: [callNode({ leadId: "l-1", text: 5, items: "two" })] })

        expect(subject.callContractProblems(SAVER, missing, [callable()])).toEqual([
            { code: "CALL_INPUT_MISSING", at: "hand.text" },
        ])
        expect(subject.callContractProblems(SAVER, unknown, [callable()])).toEqual([
            { code: "CALL_INPUT_UNKNOWN", at: "hand.color" },
        ])
        expect(subject.callContractProblems(SAVER, mistyped, [callable()])).toEqual([
            { code: "CALL_INPUT_TYPE", at: "hand.text" },
            { code: "CALL_INPUT_TYPE", at: "hand.items" },
        ])
    })

    it("treats a call that maps nothing as mapping nothing, and a target with no contract as taking no input", async () => {
        const subject = await buildPolicy()
        const empty = graphOf({ nodes: [callNode(undefined)] })

        expect(subject.callContractProblems(SAVER, empty, [callable()])).toEqual([
            { code: "CALL_INPUT_MISSING", at: "hand.leadId" },
            { code: "CALL_INPUT_MISSING", at: "hand.text" },
        ])
        expect(subject.callContractProblems(SAVER, empty, [callable({ running: graphOf() })])).toEqual([])
    })

    it("names every hand-off that is wrong, each at its own node", async () => {
        const subject = await buildPolicy()
        const gone = { agent: "sales", workflow: "gone", version: "latest", inputs: {} }
        const graph = graphOf({
            nodes: [
                { ...callNode(COVERING), key: "one", params: gone },
                { ...callNode({ leadId: "l-1" }), key: "two" },
            ],
        })

        expect(subject.callContractProblems(SAVER, graph, [callable()])).toEqual([
            { code: "CALL_TARGET_UNKNOWN", at: "one" },
            { code: "CALL_INPUT_MISSING", at: "two.text" },
        ])
    })
})

describe("brokenCallersOf", () => {
    const target = { agentId: "agent-sales", moduleKey: "sales", key: "consult" }
    const caller = (name: string, nodes: ReadonlyArray<GraphSpecNode>, agentId = "agent-chatbot"): CallingWorkflow => ({
        agentId,
        key: name.toLowerCase(),
        name,
        running: graphOf({ moduleKey: "chatbot", nodes }),
    })

    it("breaks no caller whose mapping covers the new contract", async () => {
        const subject = await buildPolicy()
        const next = graphOf({ contract: CONSULT_CONTRACT })

        expect(subject.brokenCallersOf(target, next, [caller("Front desk", [callNode(COVERING)])])).toEqual([])
    })

    it("breaks a latest caller when the new version asks for an input it does not map", async () => {
        const subject = await buildPolicy()
        const next = graphOf({
            contract: contractOf(...CONSULT_CONTRACT.inputs, { name: "address", type: "string", required: true }),
        })

        expect(subject.brokenCallersOf(target, next, [caller("Front desk", [callNode(COVERING)])])).toEqual([
            { name: "Front desk", problems: [{ code: "CALL_INPUT_MISSING", at: "hand.address" }] },
        ])
    })

    it("breaks a latest caller when the new version drops or retypes an input it maps", async () => {
        const subject = await buildPolicy()
        const dropped = graphOf({ contract: contractOf({ name: "leadId", type: "string", required: true }) })
        const retyped = graphOf({
            contract: contractOf(
                { name: "leadId", type: "number", required: true },
                { name: "text", type: "string", required: true },
            ),
        })

        expect(
            subject.brokenCallersOf(target, dropped, [caller("Front desk", [callNode({ leadId: "l-1", text: "hi" })])]),
        ).toEqual([{ name: "Front desk", problems: [{ code: "CALL_INPUT_UNKNOWN", at: "hand.text" }] }])
        expect(
            subject.brokenCallersOf(target, retyped, [caller("Front desk", [callNode({ leadId: 7, text: 5 })])]),
        ).toEqual([{ name: "Front desk", problems: [{ code: "CALL_INPUT_TYPE", at: "hand.text" }] }])
    })

    it("does not break a caller pinned to a number, nor one that calls another workflow", async () => {
        const subject = await buildPolicy()
        const next = graphOf({ contract: contractOf({ name: "address", type: "string", required: true }) })
        const pinned = caller("Pinned", [callNode(COVERING, { version: 3 })])
        const other = caller("Other", [callNode(COVERING, { workflow: "after-sale" })])
        const elsewhere = caller("Elsewhere", [callNode(COVERING, { agent: "accounting" })])

        expect(subject.brokenCallersOf(target, next, [pinned, other, elsewhere])).toEqual([])
    })

    it("breaks a caller of another agent when the new entry shuts other agents out, but not the target's own agent", async () => {
        const subject = await buildPolicy()
        const next = graphOf({ contract: CONSULT_CONTRACT, entry: { openTo: "agent" } })

        expect(subject.brokenCallersOf(target, next, [caller("Front desk", [callNode(COVERING)])])).toEqual([
            { name: "Front desk", problems: [{ code: "CALL_ENTRY_CLOSED", at: "hand" }] },
        ])
        expect(
            subject.brokenCallersOf(target, next, [caller("After sale", [callNode(COVERING)], "agent-sales")]),
        ).toEqual([])
    })

    it("judges only the latest hand-offs of a caller that also pins a number", async () => {
        const subject = await buildPolicy()
        const next = graphOf({ contract: contractOf({ name: "address", type: "string", required: true }) })
        const mixed = caller("Mixed", [
            { ...callNode(COVERING, { version: 2 }), key: "pinned" },
            { ...callNode({}), key: "floating" },
        ])

        expect(subject.brokenCallersOf(target, next, [mixed])).toEqual([
            { name: "Mixed", problems: [{ code: "CALL_INPUT_MISSING", at: "floating.address" }] },
        ])
    })
})
