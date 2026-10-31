import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { AMOUNT_FACT, amountIs } from "@tests/fixtures/builders/agent-graph.builder"
import type { SeedRule } from "../agent-graphs-seed.contracts"
import { approverOfRule, branchesFromRule } from "./seed-from-rules.policy"

/** The members of the subject under test. */
interface Subject {
    readonly branchesFromRule: typeof branchesFromRule
    readonly approverOfRule: typeof approverOfRule
}

const SUBJECT = Symbol("seed-from-rules.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { branchesFromRule, approverOfRule } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const TARGETS = { auto: "act", ask: "ask", stop: "stop" }

const ruleOf = builder<SeedRule>({
    action: "pay_supplier",
    mode: "auto",
    unit: "vnd",
    limit_vnd: null,
    auto_max: null,
    ask_max: null,
    approver_roles: ["manager"],
    approver_rooms: ["finance"],
    approver_members: ["dinh"],
    approval_policy: "sequential",
    timeout_minutes: 120,
})

const shape = (rule: SeedRule) =>
    branchesFromRule(rule, AMOUNT_FACT, TARGETS).map((entry) => ({ key: entry.key, when: entry.when, then: entry.then, next: entry.next }))

describe("seed-from-rules.policy", () => {
    it("takes the approver, policy and wait from the rule and sends a timeout to the owner of the agent, as today", async () => {
        const subject = await build()

        expect(subject.approverOfRule(ruleOf())).toEqual({
            group: { roles: ["manager"], rooms: ["finance"], members: ["dinh"] },
            policy: "sequential",
            timeoutMinutes: 120,
            onTimeout: { kind: "agent_owner" },
        })
    })

    it("turns an old limit into a strict lt and asks above it", async () => {
        const subject = await build()

        expect(shape(ruleOf({ limit_vnd: 5_000_000 }))).toEqual([
            { key: "auto", when: amountIs("lt", 5_000_000), then: "auto", next: "act" },
            { key: "else", when: "else", then: "ask", next: "ask" },
        ])
        expect(subject.branchesFromRule(ruleOf({ limit_vnd: 5_000_000 }), AMOUNT_FACT, TARGETS)[1]?.approver).not.toBeNull()
    })

    it("turns bands into an inclusive auto bound, an ask band above it and a stop above that", async () => {
        const subject = await build()

        expect(subject.branchesFromRule(ruleOf({ auto_max: 5_000_000, ask_max: 20_000_000 }), AMOUNT_FACT, TARGETS)).toMatchObject([
            { key: "auto", when: amountIs("lte", 5_000_000), then: "auto", approver: null },
            {
                key: "ask",
                when: { all: [amountIs("gt", 5_000_000), amountIs("lte", 20_000_000)] },
                then: "ask",
                next: "ask",
            },
            { key: "else", when: "else", then: "stop", next: "stop", approver: null },
        ])
    })

    it("asks for everything above the auto band when the rule has no ask bound", async () => {
        const subject = await build()

        expect(shape(ruleOf({ auto_max: 5_000_000 }))).toEqual([
            { key: "auto", when: amountIs("lte", 5_000_000), then: "auto", next: "act" },
            { key: "else", when: "else", then: "ask", next: "ask" },
        ])
        expect(subject.branchesFromRule(ruleOf({ ask_max: 9 }), AMOUNT_FACT, TARGETS).map((entry) => entry.key)).toEqual(["ask", "else"])
        expect(shape(ruleOf({ ask_max: 9 }))[0]?.when).toEqual(amountIs("lte", 9))
    })

    it("answers a rule that asks with one else that asks, and a rule that never allows with one that stops", async () => {
        const subject = await build()

        expect(shape(ruleOf({ mode: "ask" }))).toEqual([{ key: "else", when: "else", then: "ask", next: "ask" }])
        expect(shape(ruleOf({ mode: "never" }))).toEqual([{ key: "else", when: "else", then: "stop", next: "stop" }])
        expect(shape(ruleOf({ mode: "never", auto_max: 9 }))).toEqual([{ key: "else", when: "else", then: "stop", next: "stop" }])
        expect(subject.branchesFromRule(ruleOf({ mode: "never" }), AMOUNT_FACT, TARGETS)[0]?.sources).toEqual([
            { kind: "rule", action: "pay_supplier" },
        ])
    })

    it("lets a rule with no limit run alone on any amount that was read, and asks on one that was not", async () => {
        const subject = await build()

        expect(shape(ruleOf())).toEqual([
            { key: "auto", when: { fact: AMOUNT_FACT, op: "known" }, then: "auto", next: "act" },
            { key: "else", when: "else", then: "ask", next: "ask" },
        ])
        expect(subject.branchesFromRule(ruleOf(), AMOUNT_FACT, TARGETS).every((entry) => entry.when !== "else" || entry.then !== "auto")).toBe(true)
    })
})
