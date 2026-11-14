import { Test } from "@nestjs/testing"
import { waitingCardCount } from "./fact-cards.policy"
import type { WaitingProposal } from "./fact-cards.policy"
import { PRICE_5K_PER_POT_VI, PRICE_5K_VI } from "@tests/fixtures/i18n/brain-facts-spec.messages"

const SUBJECT = Symbol("fact-cards.policy")
type Subject = { waitingCardCount: typeof waitingCardCount }

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { waitingCardCount } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const proposal = (key: string, value: string, proposalKind = "set"): WaitingProposal => {
    const [subjectKey = "", attribute = ""] = key.split("|")
    return { subjectKey, attribute, value, proposalKind }
}

describe("waitingCardCount", () => {
    it("counts nothing for no proposal", async () => {
        const subject = await build()

        expect(subject.waitingCardCount([])).toBe(0)
    })

    it("counts every proposal that sets a value of its own key as a card", async () => {
        const subject = await build()

        expect(subject.waitingCardCount([proposal("a|price", "100"), proposal("b|price", "200")])).toBe(2)
    })

    it("makes one card of several proposals of the same value for one key", async () => {
        const subject = await build()

        expect(
            subject.waitingCardCount([proposal("a|price", PRICE_5K_PER_POT_VI), proposal("a|price", PRICE_5K_VI)]),
        ).toBe(1)
    })

    it("makes one card of competing values for one key", async () => {
        const subject = await build()

        expect(subject.waitingCardCount([proposal("a|price", "100"), proposal("a|price", "200")])).toBe(1)
    })

    it("makes one card of values that say the same thing, since they merge", async () => {
        const subject = await build()

        expect(subject.waitingCardCount([proposal("a|price", "650.000"), proposal("a|price", "650,000")])).toBe(1)
    })

    it("makes one card of a value and a stop-using proposal of the same key", async () => {
        const subject = await build()

        expect(subject.waitingCardCount([proposal("a|price", "100"), proposal("a|price", "", "retire")])).toBe(1)
    })

    it("counts a stop-using proposal with no competing value as its own card, once per key", async () => {
        const subject = await build()

        expect(
            subject.waitingCardCount([
                proposal("a|price", "", "retire"),
                proposal("a|price", "", "retire"),
                proposal("b|price", "", "retire"),
            ]),
        ).toBe(2)
    })
})
