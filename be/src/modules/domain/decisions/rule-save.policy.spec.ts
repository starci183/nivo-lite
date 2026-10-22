import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { AuthorityRuleRecord, RuleChange } from "@modules/domain/authority-rules"
import { ruleSummary, runsAlone } from "./rule-save.policy"

const SUBJECT = Symbol("rule-save.policy")

const changeOf = builder<RuleChange>({
    action: "give_discount",
    department: "sales",
    mode: "ask",
    limit_vnd: null,
    required_fields: [],
    note: null,
})

const savedOf = builder<AuthorityRuleRecord>({
    id: "rule-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "give_discount",
    mode: "ask",
    limit_vnd: null,
    required_fields: [],
    note: "",
    updated_at: "2026-10-22T09:00:00.000Z",
    unit: "vnd",
    auto_max: null,
    ask_max: null,
    agents: [],
    approver_roles: ["owner", "manager"],
    approver_rooms: [],
    approver_members: [],
    approval_policy: "any",
    timeout_minutes: 30,
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runsAlone, ruleSummary } }],
    }).compile()
    return moduleRef.get<{ runsAlone: typeof runsAlone; ruleSummary: typeof ruleSummary }>(SUBJECT)
}

describe("rule save policy > runsAlone", () => {
    it("is true for an auto rule, banded or not", async () => {
        const subject = await buildSubject()

        expect(subject.runsAlone(changeOf({ mode: "auto" }))).toBe(true)
    })

    it("is true for a rule that asks but has an auto band, which the bands turn into auto", async () => {
        const subject = await buildSubject()

        expect(subject.runsAlone(changeOf({ mode: "ask", auto_max: 3, ask_max: 15 }))).toBe(true)
    })

    it("is false for ask without an auto band, and for never whatever its bands", async () => {
        const subject = await buildSubject()

        expect(subject.runsAlone(changeOf({ mode: "ask" }))).toBe(false)
        expect(subject.runsAlone(changeOf({ mode: "ask", auto_max: null, ask_max: 15 }))).toBe(false)
        expect(subject.runsAlone(changeOf({ mode: "never", auto_max: 3, ask_max: 15 }))).toBe(false)
    })
})

describe("rule save policy > ruleSummary", () => {
    it("names the department, the action and the mode", async () => {
        const subject = await buildSubject()

        expect(subject.ruleSummary(savedOf(), changeOf())).toBe("sales.give_discount -> ask")
    })

    it("adds the old limit when the change carries one", async () => {
        const subject = await buildSubject()

        expect(subject.ruleSummary(savedOf(), changeOf({ limit_vnd: 1000 }))).toBe("sales.give_discount -> ask < 1000")
    })

    it("adds the unit and the bands, the policy and the time the change carried", async () => {
        const subject = await buildSubject()
        const change = changeOf({
            unit: "percent",
            auto_max: 3,
            ask_max: 15,
            approval_policy: "sequential",
            timeout_minutes: 45,
        })

        expect(subject.ruleSummary(savedOf({ mode: "auto", unit: "percent" }), change)).toBe(
            "sales.give_discount -> auto (percent: auto <= 3, ask <= 15) sequential 45m",
        )
    })

    it("marks a missing bound with a dash", async () => {
        const subject = await buildSubject()

        expect(subject.ruleSummary(savedOf({ unit: "percent" }), changeOf({ auto_max: null, ask_max: 15 }))).toBe(
            "sales.give_discount -> ask (percent: auto <= -, ask <= 15)",
        )
        expect(subject.ruleSummary(savedOf({ unit: "percent" }), changeOf({ auto_max: 3, ask_max: null }))).toBe(
            "sales.give_discount -> ask (percent: auto <= 3, ask <= -)",
        )
    })
})
