import { Test } from "@nestjs/testing"
import { STUCK_FACT } from "@modules/domain/team-chat"
import { AI_CONFUSED, stuckFactsOf, troubleOfConfusion } from "./step-trouble.policy"

const SUBJECT = Symbol("step-trouble.policy")

/** The policy as Nest provides it. */
const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { stuckFactsOf } }],
    }).compile()
    return moduleRef.get<{ readonly stuckFactsOf: typeof stuckFactsOf }>(SUBJECT)
}

describe("stuckFactsOf and the stop card's wording", () => {
    it("names the engine's own facts exactly as the stop card words them (team-chat STUCK_FACT), so no raw fact slips through unworded", async () => {
        const subject = await buildSubject()
        const facts = subject.stuckFactsOf(
            {
                workflow: "accounting.reconcile",
                nodeKey: "match",
                nodeStep: "accounting.match-payment",
                runId: "run-1",
                subject: "bank-transaction:tx-9",
            },
            troubleOfConfusion({ reason: "amount differs", question: "Mark it paid?" }),
            { bankName: "MBBANK" },
        )
        const names = facts.map(([name]) => name)
        const known: ReadonlyArray<string> = Object.values(STUCK_FACT)
        expect(names.filter((name) => !known.includes(name))).toEqual(["bankName"])
        expect(Object.fromEntries(facts)).toMatchObject({
            [STUCK_FACT.workflow]: "accounting.reconcile",
            [STUCK_FACT.step]: "match (accounting.match-payment)",
            [STUCK_FACT.code]: AI_CONFUSED,
            [STUCK_FACT.error]: "amount differs",
            [STUCK_FACT.subject]: "bank-transaction:tx-9",
            [STUCK_FACT.question]: "Mark it paid?",
            [STUCK_FACT.run]: "run-1",
        })
    })
})
