import { Test } from "@nestjs/testing"
import { AMOUNT_FACT, FACTS, amountIs, say } from "@tests/fixtures/builders/agent-graph.builder"
import type { Condition } from "../agent-graphs.contracts"
import { amountWords, conditionDepth, conditionProblems, conditionWords, evaluate, termCount } from "./condition.policy"

/** The members of the subject under test. */
interface Subject {
    readonly evaluate: typeof evaluate
    readonly conditionProblems: typeof conditionProblems
    readonly conditionWords: typeof conditionWords
    readonly amountWords: typeof amountWords
    readonly termCount: typeof termCount
    readonly conditionDepth: typeof conditionDepth
}

const SUBJECT = Symbol("condition.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            {
                provide: SUBJECT,
                useValue: { evaluate, conditionProblems, conditionWords, amountWords, termCount, conditionDepth },
            },
        ],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const KIND = "supplier_payment.kind"
const URGENT = "supplier_payment.urgent"

describe("condition.policy evaluate", () => {
    it.each([
        ["lt", 4_999_999, true],
        ["lt", 5_000_000, false],
        ["lte", 5_000_000, true],
        ["lte", 5_000_001, false],
        ["gt", 5_000_001, true],
        ["gt", 5_000_000, false],
        ["gte", 5_000_000, true],
        ["gte", 4_999_999, false],
        ["eq", 5_000_000, true],
        ["eq", 5_000_001, false],
    ] as const)("answers %s on a number: %s is %s", async (op, actual, expected) => {
        const subject = await build()

        expect(subject.evaluate(amountIs(op, 5_000_000), { [AMOUNT_FACT]: actual }, FACTS)).toBe(expected)
    })

    it("answers inequality on a number, text and a flag, and equality on text and a flag", async () => {
        const subject = await build()

        expect(subject.evaluate({ fact: AMOUNT_FACT, op: "neq", value: 5 }, { [AMOUNT_FACT]: 6 }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: AMOUNT_FACT, op: "neq", value: 5 }, { [AMOUNT_FACT]: 5 }, FACTS)).toBe(false)
        expect(subject.evaluate({ fact: KIND, op: "eq", value: "rent" }, { [KIND]: "rent" }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: KIND, op: "neq", value: "rent" }, { [KIND]: "stock" }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: URGENT, op: "eq", value: true }, { [URGENT]: true }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: URGENT, op: "neq", value: true }, { [URGENT]: true }, FACTS)).toBe(false)
    })

    it("answers a set and a known fact", async () => {
        const subject = await build()

        expect(subject.evaluate({ fact: KIND, op: "in", value: ["rent", "stock"] }, { [KIND]: "stock" }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: KIND, op: "in", value: ["rent"] }, { [KIND]: "stock" }, FACTS)).toBe(false)
        expect(subject.evaluate({ fact: KIND, op: "in", value: ["rent"] }, { [KIND]: 4 }, FACTS)).toBe(false)
        expect(subject.evaluate({ fact: AMOUNT_FACT, op: "known" }, { [AMOUNT_FACT]: 0 }, FACTS)).toBe(true)
        expect(subject.evaluate({ fact: AMOUNT_FACT, op: "known" }, {}, FACTS)).toBe(false)
    })

    it("joins terms with all and any, and a fact that could not be read satisfies nothing", async () => {
        const subject = await build()
        const both: Condition = { all: [amountIs("gte", 1), amountIs("lt", 10)] }
        const either: Condition = { any: [amountIs("lt", 1), amountIs("gt", 10)] }

        expect(subject.evaluate(both, { [AMOUNT_FACT]: 5 }, FACTS)).toBe(true)
        expect(subject.evaluate(both, { [AMOUNT_FACT]: 50 }, FACTS)).toBe(false)
        expect(subject.evaluate(either, { [AMOUNT_FACT]: 50 }, FACTS)).toBe(true)
        expect(subject.evaluate(either, { [AMOUNT_FACT]: 5 }, FACTS)).toBe(false)
        expect(subject.evaluate(amountIs("lt", 10), {}, FACTS)).toBe(false)
    })

    it("refuses a value of the wrong type instead of comparing it", async () => {
        const subject = await build()

        expect(subject.evaluate(amountIs("lt", 5_000_000), { [AMOUNT_FACT]: "4" }, FACTS)).toBe(false)
        expect(subject.evaluate({ fact: AMOUNT_FACT, op: "lt", value: "9" }, { [AMOUNT_FACT]: 1 }, FACTS)).toBe(false)
    })
})

describe("condition.policy conditionProblems", () => {
    it("accepts a condition that fits its facts", async () => {
        const subject = await build()

        expect(subject.conditionProblems(amountIs("lt", 5_000_000), FACTS)).toEqual([])
        expect(subject.conditionProblems({ fact: KIND, op: "in", value: ["rent"] }, FACTS)).toEqual([])
        expect(subject.conditionProblems({ fact: KIND, op: "known" }, FACTS)).toEqual([])
    })

    it("names an unknown fact, a wrong type, a value outside the allowed ones and an ordering on a word", async () => {
        const subject = await build()

        expect(subject.conditionProblems({ fact: "nothing", op: "known" }, FACTS)).toEqual(["unknown_fact:nothing"])
        expect(subject.conditionProblems({ fact: AMOUNT_FACT, op: "eq", value: "5" }, FACTS)).toEqual([
            `wrong_type:${AMOUNT_FACT}`,
        ])
        expect(subject.conditionProblems({ fact: KIND, op: "eq", value: "tax" }, FACTS)).toEqual([`wrong_value:${KIND}`])
        expect(subject.conditionProblems({ fact: KIND, op: "in", value: ["tax"] }, FACTS)).toEqual([`wrong_value:${KIND}`])
        expect(subject.conditionProblems({ fact: AMOUNT_FACT, op: "in", value: ["a"] }, FACTS)).toEqual([
            `wrong_value:${AMOUNT_FACT}`,
        ])
        expect(subject.conditionProblems({ fact: KIND, op: "lt", value: "rent" }, FACTS)).toEqual([`wrong_op:${KIND}`])
    })

    it("holds the depth to two groups, the terms to six and refuses an empty group", async () => {
        const subject = await build()
        const term = amountIs("lt", 1)
        const deep: Condition = { all: [{ any: [{ all: [term] }] }] }
        const wide: Condition = { all: [term, term, term, { any: [term, term, term] }] }

        expect(subject.conditionDepth(term)).toBe(0)
        expect(subject.conditionDepth(deep)).toBe(3)
        expect(subject.termCount(wide)).toBe(6)
        expect(subject.conditionProblems(deep, FACTS)).toEqual(["too_deep"])
        expect(subject.conditionProblems({ all: [wide, term] }, FACTS)).toEqual(["too_deep", "too_many_terms"])
        expect(subject.conditionProblems({ all: [] }, FACTS)).toEqual(["empty_group"])
        expect(subject.evaluate(deep, { [AMOUNT_FACT]: 0 }, FACTS)).toBe(false)
    })
})

describe("condition.policy words", () => {
    it("writes an amount as a shop owner says it", async () => {
        const subject = await build()

        expect(subject.amountWords(5_000_000, say)).toBe("5tr")
        expect(subject.amountWords(1_250_000, say)).toBe("1.25tr")
        expect(subject.amountWords(500_000, say)).toBe("500k")
        expect(subject.amountWords(800, say)).toBe("800")
    })

    it("writes a condition as a sentence from the catalog words and the registry", async () => {
        const subject = await build()

        expect(subject.conditionWords(amountIs("lt", 5_000_000), FACTS, say)).toBe("fact.amount agentGraphs.op.lt 5tr")
        expect(subject.conditionWords({ fact: KIND, op: "in", value: ["rent", "stock"] }, FACTS, say)).toBe(
            "fact.kind agentGraphs.op.in rent, stock",
        )
        expect(subject.conditionWords({ fact: KIND, op: "known" }, FACTS, say)).toBe("fact.kind agentGraphs.op.known")
        expect(subject.conditionWords({ fact: "x.y", op: "eq", value: true }, FACTS, say)).toBe("x.y agentGraphs.op.eq true")
        expect(subject.conditionWords({ all: [amountIs("gte", 1_000), amountIs("lt", 5_000_000)] }, FACTS, say)).toBe(
            "fact.amount agentGraphs.op.gte 1kagentGraphs.join.allfact.amount agentGraphs.op.lt 5tr",
        )
        expect(subject.conditionWords({ any: [amountIs("lt", 1_000), amountIs("gt", 9_000)] }, FACTS, say)).toContain(
            "agentGraphs.join.any",
        )
    })
})
