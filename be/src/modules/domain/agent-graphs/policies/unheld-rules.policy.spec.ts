import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, amountIs, branchOf, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { notHeldBy, unheldRulesOf } from "./unheld-rules.policy"
import { statedRulesSchema } from "./unheld-rules.schema"

/** The members of the subject under test. */
interface Subject {
    readonly notHeldBy: typeof notHeldBy
    readonly unheldRulesOf: typeof unheldRulesOf
}

const SUBJECT = Symbol("unheld-rules.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { notHeldBy, unheldRulesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The owner example holds 5,000,000 and 20,000,000. */
const GRAPH = graphOf(OWNER_EXAMPLE)

const stated = (...rules: ReadonlyArray<readonly [number, string]>) => ({
    rules: rules.map(([amount_vnd, quote]) => ({ amount_vnd, quote })),
})

describe("unheld-rules.policy unheldRulesOf", () => {
    it("keeps a rule the model read when its quote is in the text and no condition of the graph holds its sum", async () => {
        const subject = await build()

        expect(
            subject.unheldRulesOf(stated([8_000_000, "sentence one"]), ["Before. sentence one. After."], GRAPH),
        ).toEqual([{ amountVnd: 8_000_000, quote: "sentence one" }])
    })

    it("reads nothing from the words of the text: with no rule from the model there is no rule, whatever the text says", async () => {
        const subject = await build()

        expect(subject.unheldRulesOf(stated(), ["Anything above 8.000.000 needs approval"], GRAPH)).toEqual([])
    })

    it("drops a rule whose quote is not in any text word for word: it was not read from the setup", async () => {
        const subject = await build()
        const texts = ["The first text.", ["sentence", "two spans", "  two lines"].join("\n")]

        expect(subject.unheldRulesOf(stated([8_000_000, "a sentence nobody wrote"]), texts, GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(stated([8_000_000, "SENTENCE two"]), texts, GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(stated([8_000_000, "text. sentence"]), texts, GRAPH)).toEqual([])
        // White space is the only thing a quote may differ by.
        expect(subject.unheldRulesOf(stated([8_000_000, " sentence two   spans two lines "]), texts, GRAPH)).toEqual([
            { amountVnd: 8_000_000, quote: "sentence two spans two lines" },
        ])
    })

    it("raises nothing for a sum a branch holds, wherever the condition keeps it", async () => {
        const subject = await build()
        const nested = graphOf([
            branchOf({
                key: "small",
                when: { all: [amountIs("gte", 8_000_000), { any: [amountIs("lt", 9_000_000)] }] },
            }),
            branchOf({ key: "known", when: { fact: "supplier_payment.amount_vnd", op: "known" }, next: "act" }),
            branchOf({ key: "kinds", when: { fact: "supplier_payment.kind", op: "in", value: ["rent"] }, next: "act" }),
            branchOf({ key: "else", when: "else", mode: "ask", next: "ask" }),
        ])
        const texts = ["q"]

        expect(subject.unheldRulesOf(stated([5_000_000, "q"], [20_000_000, "q"]), texts, GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(stated([8_000_000, "q"], [9_000_000, "q"]), texts, nested)).toEqual([])
        expect(subject.unheldRulesOf(stated([5_000_000, "q"]), texts, nested)).toEqual([
            { amountVnd: 5_000_000, quote: "q" },
        ])
    })

    it("lists a sum once, in the order it was met, and keeps a quote to two hundred characters", async () => {
        const subject = await build()
        const long = `start ${"x".repeat(300)}`

        expect(
            subject.unheldRulesOf(
                stated([8_000_000, "one"], [12_000_000, "two"], [8_000_000, "three"]),
                ["one two three"],
                GRAPH,
            ),
        ).toEqual([
            { amountVnd: 8_000_000, quote: "one" },
            { amountVnd: 12_000_000, quote: "two" },
        ])
        expect(subject.unheldRulesOf(stated([8_000_000, long]), [long], GRAPH)).toEqual([
            { amountVnd: 8_000_000, quote: long.slice(0, 200) },
        ])
    })

    it("drops a sum that is not a whole positive number even when it reaches the policy unparsed", async () => {
        const subject = await build()

        expect(subject.unheldRulesOf(stated([0, "q"], [-5, "q"], [1.5, "q"]), ["q"], GRAPH)).toEqual([])
    })
})

describe("unheld-rules.schema statedRulesSchema and unheld-rules.policy notHeldBy", () => {
    it("accepts only whole positive sums with a quote", () => {
        expect(statedRulesSchema.safeParse(stated([8_000_000, "q"])).success).toBe(true)
        expect(statedRulesSchema.safeParse({ rules: [] }).success).toBe(true)
        expect(statedRulesSchema.safeParse({}).success).toBe(false)
        expect(statedRulesSchema.safeParse(stated([1.5, "q"])).success).toBe(false)
        expect(statedRulesSchema.safeParse(stated([0, "q"])).success).toBe(false)
        expect(statedRulesSchema.safeParse(stated([8, " "])).success).toBe(false)
        expect(statedRulesSchema.safeParse({ rules: [{ amount_vnd: "8", quote: "q" }] }).success).toBe(false)
    })

    it("leaves out the stored rules whose sum the graph now holds", async () => {
        const subject = await build()

        expect(
            subject.notHeldBy(
                [
                    { amountVnd: 5_000_000, quote: "held" },
                    { amountVnd: 6_000_000, quote: "not held" },
                ],
                GRAPH,
            ),
        ).toEqual([{ amountVnd: 6_000_000, quote: "not held" }])
    })
})
