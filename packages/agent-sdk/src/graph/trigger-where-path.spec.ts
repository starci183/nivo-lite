import { conditionsHold, suppliedParamsOf, triggerConditionSchema, triggerProblems } from "./workflow-contract"
import type { TriggerCondition, WorkflowTrigger } from "./workflow-contract"

// The where path of the ONE event pipeline (ROAD-API 3.1, triggers rule 13): a generic member, `data.<member>` of a member the verb declares
// in its data, or `data.<member>.<key>` of a data member that is an open flat record (the timer's own `data`, exact on scalars). The
// `data.` prefix is the root of the event's members, not a level. (Design change 2026-11-14: before, `data.<key>` keyed the timer's
// own record at the top of the scope; that record now lives at `data.data`.)

/** A timer trigger under these conditions. */
const timerOn = (...conditions: ReadonlyArray<TriggerCondition>): WorkflowTrigger => ({
    key: "timer",
    source: { kind: "timer", connectionId: null },
    conditions,
})

/** The problem codes of one timer trigger. */
const codesOf = (...conditions: ReadonlyArray<TriggerCondition>): ReadonlyArray<string> =>
    triggerProblems([timerOn(...conditions)], undefined).map((problem) => `${problem.code}@${problem.at}`)

describe("a trigger `where` path on the generic scope", () => {
    it("the timer supplies the generic members it fills (no account, no subject), its data declaring its own `data` an open flat record", () => {
        const supplied = suppliedParamsOf({ kind: "timer", connectionId: null }, undefined)
        expect(supplied.map((param) => param.name)).toEqual(["eventId", "contactId", "routeId", "data", "locale"])
        const data = supplied.find((param) => param.name === "data")
        expect(data?.members?.find((member) => member.name === "data")).toEqual({ name: "data", type: "object", open: "scalars" })
    })

    it("the condition schema takes at most three parts", () => {
        expect(triggerConditionSchema.safeParse({ param: "data.ref", op: "equals", value: "care" }).success).toBe(true)
        expect(triggerConditionSchema.safeParse({ param: "data.data.kind", op: "equals", value: "care" }).success).toBe(true)
        expect(triggerConditionSchema.safeParse({ param: "data.data.kind.deep", op: "equals", value: "care" }).success).toBe(false)
        expect(triggerConditionSchema.safeParse({ param: "data.", op: "equals", value: "care" }).success).toBe(false)
    })

    it("is legal on a generic member, a declared data member, and a key of a declared open record", () => {
        expect(codesOf({ param: "contactId", op: "present" })).toEqual([])
        expect(codesOf({ param: "data.ref", op: "equals", value: "r1" })).toEqual([])
        expect(codesOf({ param: "data.data.kind", op: "equals", value: "payment-reminder" })).toEqual([])
        expect(codesOf({ param: "data.data.kind", op: "in", value: ["a", "b"] })).toEqual([])
        expect(codesOf({ param: "data.data.tier", op: "equals", value: 2 })).toEqual([])
    })

    it("is refused, as an unknown condition, off the scope: an old top member, an undeclared data member, a key of a closed member, a non-exact op", () => {
        expect(codesOf({ param: "ref", op: "equals", value: "r1" })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.ref"])
        expect(codesOf({ param: "data.nope", op: "equals", value: "a" })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.data.nope"])
        expect(codesOf({ param: "data.ref.kind", op: "equals", value: "a" })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.data.ref.kind"])
        expect(codesOf({ param: "contactId.kind", op: "equals", value: "a" })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.contactId.kind"])
        expect(codesOf({ param: "data.data.kind", op: "contains", value: "a" })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.data.data.kind"])
        expect(codesOf({ param: "data.data.kind", op: "equals", value: { x: 1 } })).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.data.data.kind"])
    })

    it("a registration's own correlation key names a generic member or a declared data member", () => {
        const keyed = (correlationKey: WorkflowTrigger["correlationKey"]): ReadonlyArray<string> =>
            triggerProblems([{ ...timerOn(), correlationKey }], undefined).map((problem) => `${problem.code}@${problem.at}`)
        expect(keyed("contactId")).toEqual([])
        expect(keyed("data.taskId")).toEqual([])
        expect(keyed("data.nope")).toEqual(["TRIGGER_CONDITION_UNKNOWN@triggers.timer.correlationKey"])
    })

    it("resolves the path on the scope: each record's own key, exact on scalars", () => {
        const scope = { eventId: "e1", data: { ref: "r1", data: { kind: "payment-reminder", tier: 2, urgent: true } } }
        expect(conditionsHold([{ param: "data.data.kind", op: "equals", value: "payment-reminder" }], scope)).toBe(true)
        expect(conditionsHold([{ param: "data.data.kind", op: "equals", value: "care" }], scope)).toBe(false)
        expect(conditionsHold([{ param: "data.data.kind", op: "in", value: ["care", "payment-reminder"] }], scope)).toBe(true)
        expect(conditionsHold([{ param: "data.data.tier", op: "equals", value: 2 }], scope)).toBe(true)
        expect(conditionsHold([{ param: "data.data.tier", op: "equals", value: "2" }], scope)).toBe(false)
        expect(conditionsHold([{ param: "data.data.urgent", op: "equals", value: true }], scope)).toBe(true)
        expect(conditionsHold([{ param: "data.ref", op: "equals", value: "r1" }], scope)).toBe(true)
        expect(conditionsHold([{ param: "eventId", op: "equals", value: "e1" }], scope)).toBe(true)
    })

    it("a scope whose data lacks the field, or has no data, matches no condition that constrains it", () => {
        expect(conditionsHold([{ param: "data.data.kind", op: "equals", value: "care" }], { data: { data: { other: "x" } } })).toBe(false)
        expect(conditionsHold([{ param: "data.data.kind", op: "equals", value: "care" }], { data: {} })).toBe(false)
        expect(conditionsHold([{ param: "data.data.kind", op: "in", value: ["care"] }], { data: { data: "text" } })).toBe(false)
        expect(conditionsHold([{ param: "data.data.kind", op: "present" }], {})).toBe(false)
        expect(conditionsHold([{ param: "data.data.kind", op: "present" }], { data: { data: { kind: "care" } } })).toBe(true)
    })

    it("a key of a record is never read through the prototype", () => {
        expect(conditionsHold([{ param: "data.toString", op: "present" }], { data: {} })).toBe(false)
    })
})
