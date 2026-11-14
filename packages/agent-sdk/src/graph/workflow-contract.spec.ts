import { graphSpecSchema } from "./graph-spec.schema"
import {
    callInputsOf,
    callProblems,
    entryProblems,
    workflowEntrySchema,
    conditionsHold,
    contractProblems,
    contractTypeFits,
    contractTypeOfValue,
    mappedOf,
    outcomeEndsOf,
    outcomeProblems,
    suppliedParamsOf,
    triggerProblems,
} from "./workflow-contract"
import type { WorkflowContract, WorkflowOutcome, WorkflowTrigger } from "./workflow-contract"

const CONSULT: WorkflowContract = {
    inputs: [
        { name: "leadId", type: "string", required: true },
        { name: "conversationId", type: "string", required: true },
        { name: "items", type: "array", required: false },
    ],
}

// A contract a channel message supplies on the one event pipeline: the route and the contact (generic members), never a chat id.
const CHANNEL: WorkflowContract = {
    inputs: [
        { name: "routeId", type: "string", required: true },
        { name: "contactId", type: "string", required: true },
        { name: "data", type: "object", required: false },
    ],
}

const zalo: WorkflowTrigger = { key: "zalo", source: { kind: "zalo", connectionId: "c-1" } }
const telegram: WorkflowTrigger = { key: "telegram", source: { kind: "telegram", connectionId: null } }

describe("workflow triggers", () => {
    it("every trigger must supply the full contract; the problem names the trigger", () => {
        const sepay: WorkflowTrigger = { key: "bank", source: { kind: "sepay", connectionId: null } }
        expect(triggerProblems([zalo, sepay], CHANNEL)).toEqual([
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.bank.routeId" },
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.bank.contactId" },
        ])
    })

    it("two channels may start one workflow when each supplies the contract", () => {
        expect(triggerProblems([zalo, telegram], CHANNEL)).toEqual([])
    })

    it("a workflow hand-off source supplies exactly the contract", () => {
        expect(suppliedParamsOf({ kind: "workflow", connectionId: null }, CONSULT).map((param) => param.name)).toEqual([
            "leadId",
            "conversationId",
            "items",
        ])
        expect(triggerProblems([{ key: "call", source: { kind: "workflow", connectionId: null } }], CONSULT)).toEqual([])
    })

    it("refuses a mistyped supply, a connection on a kind with none, an unknown condition and a duplicate key", () => {
        const typed: WorkflowContract = { inputs: [{ name: "eventId", type: "integer", required: true }] }
        const clock: WorkflowTrigger = {
            key: "clock",
            source: { kind: "schedule", connectionId: "x" },
            conditions: [{ param: "nope", op: "present" }],
        }
        expect(triggerProblems([clock, clock], typed).map((problem) => problem.code)).toEqual([
            "TRIGGER_KEY_DUPLICATE",
            "TRIGGER_INPUT_TYPE",
            "TRIGGER_CONNECTION_INVALID",
            "TRIGGER_CONDITION_UNKNOWN",
            "TRIGGER_INPUT_TYPE",
            "TRIGGER_CONNECTION_INVALID",
            "TRIGGER_CONDITION_UNKNOWN",
        ])
    })

    it("judges nothing on a graph without triggers", () => {
        expect(triggerProblems(undefined, CONSULT)).toEqual([])
    })
})

describe("workflow contracts and hand-offs", () => {
    it("refuses a duplicate input name", () => {
        expect(
            contractProblems({
                inputs: [
                    { name: "a", type: "string", required: true },
                    { name: "a", type: "number", required: false },
                ],
            }),
        ).toEqual([{ code: "CONTRACT_INPUT_DUPLICATE", at: "contract.a" }])
    })

    it("a hand-off must cover the required inputs with values that cannot be empty, of fitting types, and nothing more", () => {
        expect(
            callProblems(
                "to-sales",
                [
                    { name: "leadId", type: "string", mayBeEmpty: true },
                    { name: "items", type: "object", mayBeEmpty: false },
                    { name: "extra", type: "string", mayBeEmpty: false },
                ],
                CONSULT,
            ),
        ).toEqual([
            { code: "CALL_INPUT_MISSING", at: "to-sales.leadId" },
            { code: "CALL_INPUT_MISSING", at: "to-sales.conversationId" },
            { code: "CALL_INPUT_TYPE", at: "to-sales.items" },
            { code: "CALL_INPUT_UNKNOWN", at: "to-sales.extra" },
        ])
        expect(
            callProblems(
                "to-sales",
                mappedOf({ leadId: { $ref: "trigger.leadId" }, conversationId: "c-1" }),
                CONSULT,
            ),
        ).toEqual([])
    })

    it("types fixed values, and an integer fits a number", () => {
        expect([1, 1.5, "a", true, [], {}, null].map((value) => contractTypeOfValue(value))).toEqual([
            "integer",
            "number",
            "string",
            "boolean",
            "array",
            "object",
            "unknown",
        ])
        expect(contractTypeFits("number", "integer")).toBe(true)
        expect(contractTypeFits("integer", "number")).toBe(false)
        expect(mappedOf("not a record")).toEqual([])
        expect(mappedOf({ a: null }, () => "string")).toEqual([{ name: "a", type: "unknown", mayBeEmpty: true }])
    })

    it("conditions compare supplied params", () => {
        const params = { text: "Em mu\u1ed1n mua HOA", channel: "zalo", tags: ["vip"] }
        expect(conditionsHold(undefined, params)).toBe(true)
        expect(conditionsHold([{ param: "text", op: "contains", value: "hoa" }], params)).toBe(true)
        expect(conditionsHold([{ param: "channel", op: "equals", value: "telegram" }], params)).toBe(false)
        expect(conditionsHold([{ param: "channel", op: "not-equals", value: "telegram" }], params)).toBe(true)
        expect(conditionsHold([{ param: "tags", op: "contains", value: "vip" }], params)).toBe(true)
        expect(conditionsHold([{ param: "leadId", op: "present" }], params)).toBe(false)
    })
})

describe("workflow outcomes", () => {
    const OUTCOMES: ReadonlyArray<WorkflowOutcome> = [
        {
            key: "won",
            label: "Ch\u1ed1t mua",
            outputs: [
                { name: "items", type: "array" },
                { name: "address", type: "string" },
            ],
        },
        { key: "lost", label: "Kh\u00e1ch kh\u00f4ng mua", outputs: [{ name: "reason", type: "string" }] },
    ]

    it("an end must fill each output of its outcome, of fitting types, and nothing more", () => {
        const ends = outcomeEndsOf([
            { key: "end-won", step: "core.outcome", params: { outcome: "won", outputs: { items: "x", note: "y" } } },
            { key: "end-lost", step: "core.outcome", params: { outcome: "lost", outputs: { reason: { $ref: "trigger.text" } } } },
            { key: "end-other", step: "core.outcome", params: { outcome: "unknown", outputs: {} } },
            { key: "send", step: "core.reply", params: {} },
        ])
        expect(outcomeProblems(OUTCOMES, ends)).toEqual([
            { code: "OUTCOME_OUTPUT_MISSING", at: "end-won.address" },
            { code: "OUTCOME_OUTPUT_TYPE", at: "end-won.items" },
            { code: "OUTCOME_OUTPUT_UNKNOWN", at: "end-won.note" },
        ])
    })

    it("refuses duplicate outcome keys and output names", () => {
        const twice: WorkflowOutcome = {
            key: "won",
            label: "Ch\u1ed1t",
            outputs: [
                { name: "a", type: "string" },
                { name: "a", type: "string" },
            ],
        }
        expect(outcomeProblems([twice, twice], []).map((problem) => problem.at)).toEqual([
            "outcomes.won",
            "outcomes.won.a",
            "outcomes.won.a",
        ])
    })

    it("the graph schema reads a contract, triggers, outcomes and an entry rule", () => {
        const parsed = graphSpecSchema.safeParse({
            schema: "nivo/agent-graph@1",
            moduleKey: "sales",
            contract: CONSULT,
            triggers: [
                { key: "call", source: { kind: "workflow", connectionId: null }, conditions: [{ param: "leadId", op: "present" }] },
            ],
            outcomes: OUTCOMES,
            entry: { openTo: "agent" },
            trigger: { kind: "tag", sources: ["agent"] },
            grant: { tools: [], effects: [] },
            nodes: [{ key: "end", kind: "output", step: "stop" }],
        })
        expect(parsed.success).toBe(true)
    })
})

// Design change (R35, R43): the conversation hold is gone (a waiting run takes the person's next line), so `holdsConversation` and its
// check `ENTRY_HOLD_WITHOUT_CONVERSATION` are deleted; the entry rule raises nothing and the schema refuses the old member.
describe("workflow entry rule", () => {
    it("raises no problem and refuses the deleted holdsConversation member", () => {
        expect(entryProblems({ openTo: "any" }, { inputs: [] })).toEqual([])
        expect(entryProblems(undefined, undefined)).toEqual([])
        expect(workflowEntrySchema.safeParse({ openTo: "any", holdsConversation: true }).success).toBe(false)
    })
})

describe("a called workflow's params under data (lane concept triggers rule 13)", () => {
    const CALLED: WorkflowContract = {
        inputs: [
            {
                name: "data",
                type: "object",
                required: true,
                members: [
                    { name: "orderId", type: "string", required: true },
                    { name: "contactId", type: "string", required: false },
                ],
            },
        ],
    }

    it("a hand-off maps the members of data, by name and type, as it mapped the inputs before", () => {
        expect(callInputsOf(CALLED).map((input) => input.name)).toEqual(["orderId", "contactId"])
        expect(callProblems("to-after", [{ name: "orderId", type: "string", mayBeEmpty: false }], CALLED)).toEqual([])
        expect(callProblems("to-after", [{ name: "contactId", type: "string", mayBeEmpty: false }], CALLED)).toEqual([
            { code: "CALL_INPUT_MISSING", at: "to-after.orderId" },
        ])
        expect(callProblems("to-after", [{ name: "data", type: "object", mayBeEmpty: false }, { name: "orderId", type: "string", mayBeEmpty: false }], CALLED)).toEqual([
            { code: "CALL_INPUT_UNKNOWN", at: "to-after.data" },
        ])
    })

    it("a contract stored before the move is mapped by its inputs, as before", () => {
        expect(callInputsOf(CONSULT)).toEqual(CONSULT.inputs)
    })

    it("a call supplies the generic members and its data members: the callee's own top inputs other than those are unsupplied", () => {
        const supplied = suppliedParamsOf({ kind: "workflow", connectionId: null }, CALLED)
        expect(supplied.map((param) => param.name)).toEqual(["eventId", "contactId", "routeId", "data", "locale"])
        expect(supplied.find((param) => param.name === "data")?.members?.map((member) => member.name)).toEqual(["orderId", "contactId"])
        expect(triggerProblems([{ key: "called", source: { kind: "workflow", connectionId: null } }], CALLED)).toEqual([])
    })
})
