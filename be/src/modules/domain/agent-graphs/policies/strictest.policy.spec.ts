import { Test } from "@nestjs/testing"
import type { GateVerdict } from "@modules/domain/authority-rules"
import { AMOUNT_FACT, FACTS, OWNER_EXAMPLE, branchOf } from "@tests/fixtures/builders/agent-graph.builder"
import { pickBranch, strictest } from "./strictest.policy"

/** The members of the subject under test. */
interface Subject {
    readonly strictest: typeof strictest
    readonly pickBranch: typeof pickBranch
}

const SUBJECT = Symbol("strictest.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { strictest, pickBranch } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const AUTO: GateVerdict = { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] }
const OVER: GateVerdict = { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [] }
const NEVER: GateVerdict = { verdict: "ask", reason: "not_allowed", reasons: ["not_allowed"], missing: [] }
const MISSING: GateVerdict = { verdict: "ask", reason: "missing_data", reasons: ["missing_data", "over_authority"], missing: ["supplier"] }

describe("strictest.policy strictest", () => {
    it("never loosens the gate with a branch that runs alone", async () => {
        const subject = await build()

        expect(subject.strictest(AUTO, "auto")).toBe(AUTO)
        expect(subject.strictest(OVER, "auto")).toBe(OVER)
        expect(subject.strictest(NEVER, "auto")).toBe(NEVER)
    })

    it("asks on the branch approver when the branch asks under a gate that runs alone, with the new reason", async () => {
        const subject = await build()

        expect(subject.strictest(AUTO, "ask")).toEqual({ verdict: "ask", reason: "branch_ask", reasons: ["branch_ask"], missing: [] })
    })

    it("asks on the branch approver when the branch asks under a gate that asks for the amount", async () => {
        const subject = await build()

        expect(subject.strictest(OVER, "ask")).toEqual({
            verdict: "ask",
            reason: "branch_ask",
            reasons: ["branch_ask", "over_authority"],
            missing: [],
        })
    })

    it("keeps a harder reason of the gate first when the branch asks", async () => {
        const subject = await build()

        expect(subject.strictest(MISSING, "ask")).toEqual({
            verdict: "ask",
            reason: "missing_data",
            reasons: ["missing_data", "over_authority"],
            missing: ["supplier"],
        })
    })

    it("turns a branch that stops into an ask with the reason of a closed rule, and a rule that never allows beats any branch", async () => {
        const subject = await build()

        expect(subject.strictest(AUTO, "stop")).toEqual({ verdict: "ask", reason: "not_allowed", reasons: ["not_allowed"], missing: [] })
        expect(subject.strictest(OVER, "stop").reasons).toEqual(["not_allowed", "over_authority"])
        expect(subject.strictest(NEVER, "auto").reason).toBe("not_allowed")
    })
})

describe("strictest.policy pickBranch", () => {
    const decide = { intent: "pay_supplier", facts: [AMOUNT_FACT], branches: OWNER_EXAMPLE }

    it("takes the first branch whose condition holds", async () => {
        const subject = await build()

        expect(subject.pickBranch(decide, { [AMOUNT_FACT]: 4_900_000 }, FACTS)?.key).toBe("small")
        expect(subject.pickBranch(decide, { [AMOUNT_FACT]: 5_000_000 }, FACTS)?.key).toBe("middle")
        expect(subject.pickBranch(decide, { [AMOUNT_FACT]: 19_999_999 }, FACTS)?.key).toBe("middle")
        expect(subject.pickBranch(decide, { [AMOUNT_FACT]: 20_000_000 }, FACTS)?.key).toBe("else")
    })

    it("takes the else when a fact could not be read, so missing data never runs alone", async () => {
        const subject = await build()

        expect(subject.pickBranch(decide, {}, FACTS)?.key).toBe("else")
    })

    it("never lets an else run alone, even one a draft left as auto", async () => {
        const subject = await build()
        const loose = { ...decide, branches: [branchOf({ key: "else", when: "else", then: "auto" })] }

        expect(subject.pickBranch(loose, { [AMOUNT_FACT]: 1 }, FACTS)).toMatchObject({ key: "else", then: "ask" })
    })

    it("answers nothing for a decide point with no else that no branch matches", async () => {
        const subject = await build()
        const open = { ...decide, branches: [branchOf({ key: "small", when: { fact: AMOUNT_FACT, op: "lt", value: 1 } })] }

        expect(subject.pickBranch(open, { [AMOUNT_FACT]: 5 }, FACTS)).toBeNull()
        expect(subject.pickBranch(open, {}, FACTS)).toBeNull()
    })
})
