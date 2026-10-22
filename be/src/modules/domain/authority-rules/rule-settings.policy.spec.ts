import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { RuleChange } from "./authority-rules.contracts"
import { AuthorityRulesErrorCode } from "./errors/authority-rules.error"
import { appliesToAgent, judgeChange } from "./rule-settings.policy"

const SUBJECT = Symbol("rule-settings.policy")

const MEMBER = "11111111-1111-4111-8111-111111111111"
const AGENT = "22222222-2222-4222-8222-222222222222"

const changeOf = builder<RuleChange>({
    action: "give_discount",
    department: "sales",
    mode: "ask",
    limit_vnd: 5000,
    required_fields: [],
    note: null,
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { judgeChange, appliesToAgent } }],
    }).compile()
    return moduleRef.get<{ judgeChange: typeof judgeChange; appliesToAgent: typeof appliesToAgent }>(SUBJECT)
}

describe("rule settings policy > the mode and the old limit", () => {
    it("keeps the mode and the old limit of a change that names no approval settings, and patches nothing", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf())).toEqual({ kind: "ok", value: { mode: "ask", limit_vnd: 5000, settings: {} } })
    })

    it("makes the mode follow the bands: auto when there is an auto band, else ask", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ mode: "ask", auto_max: 3, ask_max: 15, unit: "percent" }))).toMatchObject({
            kind: "ok",
            value: { mode: "auto", limit_vnd: null },
        })
        expect(judge(changeOf({ mode: "auto", auto_max: null, ask_max: 15, unit: "percent" }))).toMatchObject({
            kind: "ok",
            value: { mode: "ask", limit_vnd: null },
        })
    })

    it("keeps never as never whatever the bands are", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ mode: "never", auto_max: 3, ask_max: 15 }))).toMatchObject({
            kind: "ok",
            value: { mode: "never" },
        })
    })

    it("drops the old VND limit when the unit is not VND, and keeps the mode when the bands are cleared", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ unit: "count", auto_max: null, ask_max: null }))).toMatchObject({
            kind: "ok",
            value: { mode: "ask", limit_vnd: null, settings: { unit: "count", auto_max: null, ask_max: null } },
        })
    })

    it("patches only the keys named and removes duplicates from the lists", async () => {
        const { judgeChange: judge } = await buildSubject()
        const change = changeOf({
            approver_roles: ["manager", "manager", "owner"],
            approver_rooms: ["sales", "sales"],
            approver_members: [MEMBER, MEMBER],
            approval_policy: "all",
            timeout_minutes: 60,
            agents: [AGENT, AGENT],
        })

        expect(judge(change)).toEqual({
            kind: "ok",
            value: {
                mode: "ask",
                limit_vnd: 5000,
                settings: {
                    approver_roles: ["manager", "owner"],
                    approver_rooms: ["sales"],
                    approver_members: [MEMBER],
                    approval_policy: "all",
                    timeout_minutes: 60,
                    agents: [AGENT],
                },
            },
        })
    })
})

describe("rule settings policy > the bands", () => {
    it.each([
        { name: "an auto band above the ask band", change: changeOf({ auto_max: 20, ask_max: 10 }) },
        { name: "a negative bound", change: changeOf({ auto_max: -1, ask_max: 10 }) },
        { name: "a percentage above one hundred", change: changeOf({ unit: "percent", auto_max: 5, ask_max: 120 }) },
        { name: "a fractional count", change: changeOf({ unit: "count", auto_max: 1.5, ask_max: 3 }) },
        { name: "one bound without the other", change: changeOf({ auto_max: 3 }) },
        { name: "the other bound without the first", change: changeOf({ ask_max: 3 }) },
    ])("refuses $name", async ({ change }) => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(change)).toEqual({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidBands,
            params: undefined,
        })
    })

    it("refuses a bound that is not a number", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ auto_max: Number.NaN, ask_max: 3 }))).toMatchObject({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidBands,
        })
    })

    it("accepts a percentage of one hundred and equal bands", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ unit: "percent", auto_max: 100, ask_max: 100 })).kind).toBe("ok")
    })
})

describe("rule settings policy > the unit, the policy and the time", () => {
    it("refuses an unknown unit", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(Object.assign(changeOf(), { unit: "nights" }))).toEqual({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidUnit,
            params: { unit: "nights" },
        })
    })

    it("refuses an unknown approval policy", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(Object.assign(changeOf(), { approval_policy: "majority" }))).toEqual({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidPolicy,
            params: { policy: "majority" },
        })
    })

    it.each([0, 10_081, 1.5])("refuses %s minutes", async (minutes) => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ timeout_minutes: minutes }))).toMatchObject({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidTimeout,
        })
    })

    it("accepts the shortest and the longest time", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ timeout_minutes: 1 })).kind).toBe("ok")
        expect(judge(changeOf({ timeout_minutes: 10_080 })).kind).toBe("ok")
    })
})

describe("rule settings policy > the group and the agents", () => {
    it.each([
        { name: "an unknown role", change: Object.assign(changeOf(), { approver_roles: ["admin"] }) },
        { name: "a malformed room key", change: changeOf({ approver_rooms: ["Sales Room"] }) },
        { name: "a malformed member id", change: changeOf({ approver_members: ["anh-minh"] }) },
    ])("refuses a group with $name", async ({ change }) => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(change)).toMatchObject({ kind: "refused", code: AuthorityRulesErrorCode.InvalidGroup })
    })

    it("refuses agents that are not ids", async () => {
        const { judgeChange: judge } = await buildSubject()

        expect(judge(changeOf({ agents: ["ai-sales"] }))).toMatchObject({
            kind: "refused",
            code: AuthorityRulesErrorCode.InvalidAgents,
        })
    })
})

describe("rule settings policy > appliesToAgent", () => {
    it("applies to every caller when no agent is named", async () => {
        const { appliesToAgent: applies } = await buildSubject()

        expect(applies([AGENT], null)).toBe(true)
    })

    it("applies to every agent when the rule lists none or does not carry the list", async () => {
        const { appliesToAgent: applies } = await buildSubject()

        expect(applies([], AGENT)).toBe(true)
        expect(applies(undefined, AGENT)).toBe(true)
    })

    it("applies only to the agents the rule lists", async () => {
        const { appliesToAgent: applies } = await buildSubject()

        expect(applies([AGENT], AGENT)).toBe(true)
        expect(applies([AGENT], MEMBER)).toBe(false)
    })
})
