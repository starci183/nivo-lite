import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import type { RuleChange } from "@modules/domain/authority-rules"
import type { AuthorityActionRecord } from "./authority-actions.contracts"
import { ruleRefusalOf, runsAlone } from "./rule-refusal.policy"

const SUBJECT = Symbol("rule-refusal.policy")

const changeOf = builder<RuleChange>({
    action: "give_discount",
    department: "sales",
    mode: "ask",
    limit_vnd: null,
    required_fields: [],
    note: null,
})

const recordOf = builder<AuthorityActionRecord>({
    action: "give_discount",
    module_key: "sales",
    sort_order: 1,
    default_mode: "ask",
    default_limit_vnd: null,
    default_required_fields: [],
    amount_limit: false,
    max_mode: null,
    label: { en: "Give a discount", vi: "Giam gia" },
})

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { runsAlone, ruleRefusalOf } }],
    }).compile()
    return moduleRef.get<{ runsAlone: typeof runsAlone; ruleRefusalOf: typeof ruleRefusalOf }>(SUBJECT)
}

describe("rule refusal policy > runsAlone", () => {
    it("is true for an auto rule, and for an ask rule with an auto band", async () => {
        const subject = await buildSubject()

        expect(subject.runsAlone(changeOf({ mode: "auto" }))).toBe(true)
        expect(subject.runsAlone(changeOf({ mode: "ask", auto_max: 3, ask_max: 15 }))).toBe(true)
    })

    it("is false for ask without an auto band, and for never whatever its bands", async () => {
        const subject = await buildSubject()

        expect(subject.runsAlone(changeOf({ mode: "ask" }))).toBe(false)
        expect(subject.runsAlone(changeOf({ mode: "never", auto_max: 3, ask_max: 15 }))).toBe(false)
    })
})

describe("rule refusal policy > ruleRefusalOf", () => {
    it("refuses an action the registry does not hold under the department", async () => {
        const subject = await buildSubject()

        expect(subject.ruleRefusalOf(undefined, changeOf())).toBe("unknown_action")
        expect(subject.ruleRefusalOf(recordOf({ module_key: "accounting" }), changeOf())).toBe("unknown_action")
    })

    it("refuses a rule that runs alone for a capped action, and allows the rest", async () => {
        const subject = await buildSubject()

        expect(subject.ruleRefusalOf(recordOf({ max_mode: "ask" }), changeOf({ mode: "auto" }))).toBe("mode_capped")
        expect(subject.ruleRefusalOf(recordOf({ max_mode: "ask" }), changeOf({ mode: "ask" }))).toBeNull()
        expect(subject.ruleRefusalOf(recordOf(), changeOf({ mode: "auto" }))).toBeNull()
    })
})
