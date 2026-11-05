import { Test } from "@nestjs/testing"
import type { AuthorityRule } from "@modules/domain/authority-rules"
import { authorityDecisionOf as realAuthorityDecisionOf } from "./door-authority.policy"

const SUBJECT = Symbol("door-authority.policy")

interface Subject {
    readonly authorityDecisionOf: typeof realAuthorityDecisionOf
}

const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { authorityDecisionOf: realAuthorityDecisionOf },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const ruleOf = (overrides: Partial<AuthorityRule> = {}): AuthorityRule => ({
    id: "rule-1",
    department: "sales",
    action: "sales.moveStage",
    mode: "auto",
    limit_vnd: null,
    required_fields: [],
    ...overrides,
})

const ACTION = "sales.moveStage"

describe("authorityDecisionOf", () => {
    let authorityDecisionOf: Subject["authorityDecisionOf"]

    beforeAll(async () => {
        ;({ authorityDecisionOf } = await build())
    })

    it("allows an action the owner set no rule for", () => {
        expect(authorityDecisionOf(null, ACTION, {})).toBe("allow")
    })

    it("allows an action whose rule runs it alone", () => {
        expect(authorityDecisionOf(ruleOf(), ACTION, { id: "lead-1" })).toBe("allow")
    })

    it("refuses an action whose rule says never", () => {
        expect(authorityDecisionOf(ruleOf({ mode: "never" }), ACTION, {})).toBe("deny")
    })

    it("asks a person when the rule asks", () => {
        expect(authorityDecisionOf(ruleOf({ mode: "ask" }), ACTION, {})).toBe("ask")
    })

    it("asks a person when the amount reaches the limit of the rule", () => {
        const rule = ruleOf({ limit_vnd: 1_000_000 })

        expect(authorityDecisionOf(rule, ACTION, { amount_vnd: 999_999 })).toBe("allow")
        expect(authorityDecisionOf(rule, ACTION, { amount_vnd: 1_000_000 })).toBe("ask")
    })

    it("does not read an amount that is not a number", () => {
        const rule = ruleOf({ limit_vnd: 1_000_000 })

        expect(authorityDecisionOf(rule, ACTION, { amount_vnd: "2000000" })).toBe("allow")
        expect(authorityDecisionOf(rule, ACTION, { amount_vnd: null })).toBe("allow")
    })

    it("asks a person while a required field is missing, and counts a text or a number as present", () => {
        const rule = ruleOf({ required_fields: ["reason", "count"] })

        expect(authorityDecisionOf(rule, ACTION, { reason: "late", count: 2 })).toBe("allow")
        expect(authorityDecisionOf(rule, ACTION, { reason: "late" })).toBe("ask")
    })

    it("does not count a boolean, a list or an object as a field of the proposal", () => {
        const rule = ruleOf({ required_fields: ["reason"] })

        expect(authorityDecisionOf(rule, ACTION, { reason: true })).toBe("ask")
        expect(authorityDecisionOf(rule, ACTION, { reason: ["late"] })).toBe("ask")
        expect(authorityDecisionOf(rule, ACTION, { reason: { text: "late" } })).toBe("ask")
    })
})
