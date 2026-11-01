import { Test } from "@nestjs/testing"
import type { MoneyEvidence, MoneyTurn } from "@modules/domain/authority-rules"
import { OWNER_EXAMPLE, graphOf, nodeOf } from "@tests/fixtures/builders/agent-graph.builder"
import { MONEY_AMOUNT, MONEY_SOURCE, MONEY_VIA, moneyAccepted, moneyFactsOf } from "./money-facts.policy"

/** The members of the subject under test. */
interface Subject {
    readonly moneyAccepted: typeof moneyAccepted
    readonly moneyFactsOf: typeof moneyFactsOf
}

const SUBJECT = Symbol("money-facts.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { moneyAccepted, moneyFactsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const claim: MoneyEvidence = { amountVnd: 300_000, source: "claimed", via: "chat_text" }
const image: MoneyEvidence = { amountVnd: 450_000, source: "claimed", via: "chat_image" }
const feed: MoneyEvidence = { amountVnd: 500_000, source: "received", via: "sepay" }
const turnOf = (evidence: ReadonlyArray<MoneyEvidence>, asked = true): MoneyTurn => ({ evidence, asked })

/** The graph of the owner example with a trigger that accepts only the sources named, or every source when none is. */
const graphAccepting = (sources: ReadonlyArray<string> | undefined) => {
    const base = graphOf(OWNER_EXAMPLE)
    return {
        ...base,
        nodes: base.nodes.map((node) => (node.kind === "trigger" ? nodeOf({ ...node, moneySources: sources }) : node)),
    }
}

describe("money-facts.policy moneyAccepted", () => {
    it("keeps only the evidence whose road the trigger of the graph accepts", async () => {
        const subject = await build()

        expect(
            subject.moneyAccepted(graphAccepting(["chat_text", "chat_image"]), turnOf([claim, image, feed])),
        ).toEqual({
            asked: true,
            evidence: [claim, image],
        })
    })

    it("can leave a turn with no evidence at all, which still counts as a money event", async () => {
        const subject = await build()

        expect(subject.moneyAccepted(graphAccepting(["sepay"]), turnOf([claim, image]))).toEqual({
            asked: true,
            evidence: [],
        })
    })

    it("counts every road when no trigger chose, and passes a turn without money on as it is", async () => {
        const subject = await build()
        const turn = turnOf([claim, feed])

        expect(subject.moneyAccepted(graphAccepting(undefined), turn)).toBe(turn)
        expect(subject.moneyAccepted(graphAccepting([]), turn)).toBe(turn)
        expect(subject.moneyAccepted(graphAccepting(["sepay"]), undefined)).toBeUndefined()
    })

    it("reads the choice of the trigger nodes only, so another node cannot narrow it", async () => {
        const subject = await build()
        const base = graphOf(OWNER_EXAMPLE)
        const stray = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.kind === "trigger" ? node : nodeOf({ ...node, moneySources: ["sepay"] }),
            ),
        }
        const withoutTrigger = { ...base, nodes: base.nodes.filter((node) => node.kind !== "trigger") }

        expect(subject.moneyAccepted(withoutTrigger, turnOf([claim]))).toEqual(turnOf([claim]))
        expect(subject.moneyAccepted(stray, turnOf([claim, feed]))).toEqual(turnOf([claim, feed]))
    })
})

describe("money-facts.policy moneyFactsOf", () => {
    it("reads the amount, where it came from and the road it came by", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(turnOf([claim]))).toEqual({
            [MONEY_AMOUNT]: 300_000,
            [MONEY_SOURCE]: "claimed",
            [MONEY_VIA]: "chat_text",
        })
    })

    it("lets money received win over money claimed, whichever comes first", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(turnOf([claim, feed]))).toEqual({
            [MONEY_AMOUNT]: 500_000,
            [MONEY_SOURCE]: "received",
            [MONEY_VIA]: "sepay",
        })
        expect(subject.moneyFactsOf(turnOf([feed, claim]))[MONEY_SOURCE]).toBe("received")
    })

    it("takes the first claim when nothing was received, and skips evidence that has no amount", async () => {
        const subject = await build()
        const unclear: MoneyEvidence = { amountVnd: null, source: "received", via: "invoice_paid" }

        expect(subject.moneyFactsOf(turnOf([unclear, claim, image]))).toEqual({
            [MONEY_AMOUNT]: 300_000,
            [MONEY_SOURCE]: "claimed",
            [MONEY_VIA]: "chat_text",
        })
    })

    it("gives no facts to a money event with no amount, so the branch falls to its else and the turn waits", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(turnOf([], true))).toEqual({})
        expect(subject.moneyFactsOf(turnOf([{ amountVnd: null, source: "claimed", via: "chat_image" }], true))).toEqual(
            {},
        )
    })

    it("reads 0 from a source that is none for a turn with no money event, which is a reading and not a gap", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(turnOf([], false))).toEqual({
            [MONEY_AMOUNT]: 0,
            [MONEY_SOURCE]: "none",
            [MONEY_VIA]: "none",
        })
    })

    it("answers nothing for a turn that carries no money information at all", async () => {
        const subject = await build()

        expect(subject.moneyFactsOf(undefined)).toEqual({})
    })
})
