import {
    TRIGGER_SOURCES,
    TRIGGER_SOURCE_KINDS,
    providerTriggerOf,
    suppliedParamsOf,
    triggerProblems,
    triggerSourceSchema,
} from "./workflow-contract"
import type { ProviderTriggerLookup, WorkflowContract, WorkflowTrigger } from "./workflow-contract"

const PAYMENT: WorkflowContract = {
    inputs: [
        { name: "transactionId", type: "string", required: false },
        { name: "renewalId", type: "string", required: false },
    ],
}

/** The host's declarations: one bank trigger whose direction is a closed choice. */
const HOST: ProviderTriggerLookup = (key) =>
    key === "sepay:transaction.received"
        ? {
              supplies: [
                  { name: "transactionId", type: "string" },
                  { name: "direction", type: "string" },
                  { name: "connectionId", type: "string" },
              ],
              filterable: ["direction"],
          }
        : undefined

const bank = (change: Partial<WorkflowTrigger> = {}): WorkflowTrigger => ({
    key: "bank",
    source: { kind: "provider", connectionId: null, provider: "sepay", trigger: "transaction.received" },
    conditions: [{ param: "direction", op: "equals", value: "in" }],
    ...change,
})

describe("a trigger source of kind provider", () => {
    it("is a source kind the editor lists, on the one event pipeline, on a connection or on any", () => {
        expect(TRIGGER_SOURCE_KINDS).toContain("provider")
        expect(TRIGGER_SOURCES.provider).toEqual({ kind: "provider", connectionKind: "provider", supplies: [] })
        expect(triggerProblems([bank({ source: { ...bank().source, connectionId: "conn-1" } })], PAYMENT, HOST)).toEqual([])
    })

    it("names its provider trigger as <provider>:<trigger>; another kind names none", () => {
        expect(providerTriggerOf(bank().source)).toBe("sepay:transaction.received")
        expect(providerTriggerOf({ kind: "sepay", connectionId: null })).toBeNull()
        expect(providerTriggerOf({ kind: "provider", connectionId: null })).toBeNull()
    })

    it("parses with its provider and trigger, and keeps every older source as it was", () => {
        expect(triggerSourceSchema.parse(bank().source)).toEqual(bank().source)
        expect(triggerSourceSchema.parse({ kind: "sepay", connectionId: null })).toEqual({ kind: "sepay", connectionId: null })
        expect(triggerSourceSchema.safeParse({ ...bank().source, provider: "Se Pay" }).success).toBe(false)
    })

    it("registers with a filter on a filterable field when the host declares the trigger", () => {
        expect(triggerProblems([bank()], PAYMENT, HOST)).toEqual([])
        expect(suppliedParamsOf(bank().source, PAYMENT, HOST).map((param) => param.name)).toEqual([
            "transactionId",
            "direction",
            "connectionId",
        ])
    })

    it("refuses a trigger the host does not declare", () => {
        const refund = bank({ source: { ...bank().source, trigger: "refund.received" }, conditions: [] })
        expect(triggerProblems([refund], PAYMENT, HOST)).toEqual([
            { code: "TRIGGER_PROVIDER_UNKNOWN", at: "triggers.bank.source" },
        ])
    })

    it("refuses a provider source that names nothing, and another kind that names a provider", () => {
        const unnamed = bank({ source: { kind: "provider", connectionId: null }, conditions: [] })
        const stray: WorkflowTrigger = { key: "call", source: { kind: "workflow", connectionId: null, provider: "sepay" } }
        expect(triggerProblems([unnamed], PAYMENT).map((problem) => problem.code)).toEqual(["TRIGGER_PROVIDER_UNNAMED"])
        expect(triggerProblems([stray], PAYMENT).map((problem) => problem.code)).toEqual(["TRIGGER_PROVIDER_UNNAMED"])
    })

    it("refuses a filter on an id, and any filter by containment: a filter never reads words", () => {
        const byId = bank({ conditions: [{ param: "transactionId", op: "equals", value: "tx-1" }] })
        const byWords = bank({ conditions: [{ param: "direction", op: "contains", value: "i" }] })
        expect(triggerProblems([byId], PAYMENT, HOST)).toEqual([
            { code: "TRIGGER_FILTER_INVALID", at: "triggers.bank.transactionId" },
        ])
        expect(triggerProblems([byWords], PAYMENT, HOST)).toEqual([
            { code: "TRIGGER_FILTER_INVALID", at: "triggers.bank.direction" },
        ])
        expect(triggerProblems([byWords], PAYMENT).map((problem) => problem.code)).toEqual(["TRIGGER_FILTER_INVALID"])
    })

    it("refuses a required input the provider does not supply, once the host told what it supplies", () => {
        const strict: WorkflowContract = { inputs: [{ name: "renewalId", type: "string", required: true }] }
        expect(triggerProblems([bank()], strict, HOST)).toEqual([
            { code: "TRIGGER_INPUT_UNSUPPLIED", at: "triggers.bank.renewalId" },
        ])
    })

    it("leaves the payload to the host where none told its declarations: a package's own check judges the shape alone", () => {
        expect(triggerProblems([bank()], PAYMENT)).toEqual([])
    })
})
