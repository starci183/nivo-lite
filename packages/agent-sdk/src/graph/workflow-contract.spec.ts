import { graphSpecSchema } from "./graph-spec.schema"
import {
    callProblems,
    entryProblems,
    conditionsHold,
    contractProblems,
    contractTypeFits,
    contractTypeOfValue,
    mappedOf,
    outcomeEndsOf,
    outcomeProblems,
    suppliedParamsOf,
    triggerProblems,
    wakesOfTriggers,
} from "./workflow-contract"
import type { WorkflowContract, WorkflowOutcome, WorkflowTrigger } from "./workflow-contract"

const CONSULT: WorkflowContract = {
    inputs: [
        { name: "leadId", type: "string", required: true },
        { name: "conversationId", type: "string", required: true },
        { name: "items", type: "array", required: false },
    ],
}

const zalo: WorkflowTrigger = { key: "zalo", source: { kind: "zalo", connectionId: "c-1" } }
const telegram: WorkflowTrigger = { key: "telegram", source: { kind: "telegram", connectionId: null } }

describe("workflow triggers", () => {
    it("every trigger must supply the full contract; the problem names the trigger", () => {
        const sepay: WorkflowTrigger = { key: "bank", source: { kind: "sepay", connectionId: null } }
        expect(triggerProblems([zalo, sepay], ["channel", "system-event"], CONSULT)).toEqual([
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.bank.leadId" },
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.bank.conversationId" },
        ])
    })

    it("two channels may start one workflow when each supplies the contract", () => {
        expect(triggerProblems([zalo, telegram], ["channel"], CONSULT)).toEqual([])
        expect(wakesOfTriggers([zalo, telegram])).toEqual(["channel"])
    })

    it("a workflow hand-off source supplies exactly the contract", () => {
        expect(suppliedParamsOf({ kind: "workflow", connectionId: null }, CONSULT).map((param) => param.name)).toEqual([
            "leadId",
            "conversationId",
            "items",
        ])
        expect(triggerProblems([{ key: "call", source: { kind: "workflow", connectionId: null } }], ["agent"], CONSULT)).toEqual([])
    })

    it("refuses a mistyped supply, a connection on a kind with none, an unknown condition, a duplicate key and other wakes", () => {
        const typed: WorkflowContract = { inputs: [{ name: "slotMs", type: "string", required: true }] }
        const clock: WorkflowTrigger = {
            key: "clock",
            source: { kind: "schedule", connectionId: "x" },
            conditions: [{ param: "nope", op: "present" }],
        }
        expect(triggerProblems([clock, clock], ["channel"], typed).map((problem) => problem.code)).toEqual([
            "TRIGGER_KEY_DUPLICATE",
            "TRIGGER_INPUT_TYPE",
            "TRIGGER_CONNECTION_INVALID",
            "TRIGGER_CONDITION_UNKNOWN",
            "TRIGGER_INPUT_TYPE",
            "TRIGGER_CONNECTION_INVALID",
            "TRIGGER_CONDITION_UNKNOWN",
            "TRIGGER_SOURCES_MISMATCH",
        ])
    })

    it("judges nothing on a graph without triggers", () => {
        expect(triggerProblems(undefined, ["channel"], CONSULT)).toEqual([])
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
        const params = { text: "Em muốn mua HOA", channel: "zalo", tags: ["vip"] }
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
            label: "Chốt mua",
            outputs: [
                { name: "items", type: "array" },
                { name: "address", type: "string" },
            ],
        },
        { key: "lost", label: "Khách không mua", outputs: [{ name: "reason", type: "string" }] },
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
            label: "Chốt",
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
            grant: { rights: [], tools: [], effects: [] },
            nodes: [{ key: "end", kind: "output", step: "stop" }],
        })
        expect(parsed.success).toBe(true)
    })
})

describe("workflow entry rule", () => {
    it("a workflow that holds the conversation must require it", () => {
        expect(entryProblems({ openTo: "any", holdsConversation: true }, { inputs: [] })).toEqual([
            { code: "ENTRY_HOLD_WITHOUT_CONVERSATION", at: "entry.holdsConversation" },
        ])
        expect(entryProblems({ openTo: "any", holdsConversation: true }, CONSULT)).toEqual([])
        expect(entryProblems({ openTo: "any" }, { inputs: [] })).toEqual([])
        expect(entryProblems(undefined, undefined)).toEqual([])
    })
})
