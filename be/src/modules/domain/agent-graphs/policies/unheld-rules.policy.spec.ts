import { Test } from "@nestjs/testing"
import { OWNER_EXAMPLE, amountIs, branchOf, graphOf } from "@tests/fixtures/builders/agent-graph.builder"
import { unheldRulesOf } from "./unheld-rules.policy"

/** The members of the subject under test. */
interface Subject {
    readonly unheldRulesOf: typeof unheldRulesOf
}

const SUBJECT = Symbol("unheld-rules.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { unheldRulesOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The owner example holds 5,000,000 and 20,000,000. */
const GRAPH = graphOf(OWNER_EXAMPLE)

const ACCENTED_RULE = "Gi\u00E1 n\u00E0o tr\u00EAn 8tr th\u00EC h\u1ECFi ch\u1EE7 tr\u01B0\u1EDBc"

describe("unheld-rules.policy unheldRulesOf", () => {
    it("lists a sum the text states as a rule that no condition of the graph holds", async () => {
        const subject = await build()

        expect(subject.unheldRulesOf(["Don tren 8 trieu phai xin y kien chu."], GRAPH)).toEqual([
            { amountVnd: 8_000_000, quote: "Don tren 8 trieu phai xin y kien chu" },
        ])
    })

    it("reads the words with their accents, and every kind of sentence end", async () => {
        const subject = await build()

        expect(subject.unheldRulesOf([`${ACCENTED_RULE}! C\u00F2n l\u1EA1i t\u1EF1 l\u00E0m.`], GRAPH)).toEqual([
            { amountVnd: 8_000_000, quote: ACCENTED_RULE },
        ])
        expect(subject.unheldRulesOf(["Over 1,5 trieu we need approval"], GRAPH)).toEqual([
            { amountVnd: 1_500_000, quote: "Over 1,5 trieu we need approval" },
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
            branchOf({ key: "else", when: "else", then: "ask", next: "ask" }),
        ])

        expect(subject.unheldRulesOf(["Tren 5 trieu phai duyet", "Tren 20 trieu phai duyet"], GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(["Tren 8 trieu phai duyet", "Duoi 9 trieu thi duyet"], nested)).toEqual([])
        expect(subject.unheldRulesOf(["Tren 5 trieu phai duyet"], nested)).toEqual([
            { amountVnd: 5_000_000, quote: "Tren 5 trieu phai duyet" },
        ])
    })

    it("raises nothing for a sentence that asks for no person, one with no sum, and a text with no sentence", async () => {
        const subject = await build()

        expect(subject.unheldRulesOf(["Tra sua gia 8 trieu mot ly"], GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(["Moi don phai duyet"], GRAPH)).toEqual([])
        expect(subject.unheldRulesOf(["", "..."], GRAPH)).toEqual([])
        expect(subject.unheldRulesOf([], GRAPH)).toEqual([])
    })

    it("lists a sum once however many texts or sentences state it, in the order they were met", async () => {
        const subject = await build()

        expect(
            subject.unheldRulesOf(
                ["Tren 8 trieu phai duyet. Tren 12 trieu cho chu duyet", "Moi khoan 8tr xin y kien"],
                GRAPH,
            ),
        ).toEqual([
            { amountVnd: 8_000_000, quote: "Tren 8 trieu phai duyet" },
            { amountVnd: 12_000_000, quote: "Tren 12 trieu cho chu duyet" },
        ])
    })

    it("keeps a quote to two hundred characters", async () => {
        const subject = await build()
        const long = `Tren 8 trieu phai duyet ${"x".repeat(300)}`

        const [rule] = subject.unheldRulesOf([long], GRAPH)

        expect(rule?.quote).toBe(long.slice(0, 200))
        expect(rule?.amountVnd).toBe(8_000_000)
    })
})
