import { Test } from "@nestjs/testing"
import { passageTextHashOf } from "@modules/domain/knowledge-chunks"
import { blanksIn } from "./blank.policy"
import type { CriticCandidate, CriticFact, CriticPassage, CriticSay, CritiqueInput } from "./document-critic.contracts"
import fx from "./document-critic-rules.policy.fixtures.json"
import { criticRules } from "./document-critic-rules.policy"
import { looksLikeSlip, moneyIn } from "./document-critic-text.policy"

const SUBJECT = Symbol("document-critic-rules.policy")
type Subject = { criticRules: typeof criticRules }
const buildSubject = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({ providers: [{ provide: SUBJECT, useValue: { criticRules } }] }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

/** The words as a key and its params, so a spec reads which message a point carries without the catalog's Vietnamese. */
const say: CriticSay = (key, params = {}) =>
    [key, ...Object.entries(params).map(([name, value]) => `${name}=${value}`)].join("|")

const passage = (order: number, text: string): CriticPassage => ({ id: `c${order}`, order, text, hash: passageTextHashOf(text) })

const fact = (id: string, over: Partial<CriticFact>): CriticFact => ({
    id,
    subjectLabel: fx.shop.basket,
    subjectKey: "gio-hoa-nho",
    attributeLabel: fx.shop.price,
    attribute: "gia",
    value: fx.shop.basketValue,
    unit: null,
    status: "proposed",
    quote: null,
    chunkHash: null,
    installationId: null,
    ...over,
})

const inputOf = (texts: ReadonlyArray<string>, over: Partial<CritiqueInput> = {}): CritiqueInput => ({
    say,
    workspaceId: "w1",
    sourceId: "s1",
    title: "Shop rules",
    today: "2026-11-11",
    passages: texts.map((text, index) => passage(index, text)),
    reviewed: new Set(),
    facts: [],
    candidates: new Map(),
    ...over,
})

describe("text helpers", () => {
    it("reads money only with a currency or a scale, never 'five orders' or 'five or more'", () => {
        expect(moneyIn(fx.money.fee).map((one) => one.amount)).toEqual([30_000])
        expect(moneyIn(fx.money.mixed).map((one) => one.amount)).toEqual([350_000, 25_000])
        expect(moneyIn(fx.money.orders)).toEqual([])
        expect(moneyIn(fx.money.sign)[0]?.amount).toBe(2_000)
    })

    it("calls a power of ten apart a typing slip, other gaps a contradiction", () => {
        expect(looksLikeSlip(5_000, 50_000)).toBe(true)
        expect(looksLikeSlip(30_000, 300_000)).toBe(true)
        expect(looksLikeSlip(25_000, 2_000)).toBe(false)
        expect(looksLikeSlip(30_000, 25_000)).toBe(false)
    })

    it("finds blanks a stored (normalised) passage still holds, and template text of another shop; never an ellipsis glued to a word", () => {
        expect(blanksIn(fx.blanks.bracket).map((one) => one.text)).toEqual(["[...]"])
        expect(blanksIn(fx.blanks.dots).map((one) => one.kind)).toEqual(["blank"])
        expect(blanksIn(fx.blanks.template).map((one) => one.kind)).toEqual(["template", "template"])
        expect(blanksIn(fx.blanks.prose)).toEqual([])
    })
})

describe("criticRules", () => {
    it("inside_contradiction: one fee given two amounts in two sections, both quoted, the two values as choices", async () => {
        const { criticRules: rules } = await buildSubject()
        const texts = [fx.inside.first, fx.inside.second]
        const keyed = { subjectLabel: fx.inside.subject, subjectKey: "giao-hang-noi-thanh", attributeLabel: fx.inside.attribute, attribute: "phi-giao-hang" }
        const facts = [
            fact("f30", { ...keyed, value: fx.inside.a, chunkHash: passageTextHashOf(fx.inside.first) }),
            fact("f25", { ...keyed, value: fx.inside.b, chunkHash: passageTextHashOf(fx.inside.second) }),
        ]
        const points = rules(inputOf(texts, { facts }))
        expect(points).toHaveLength(1)
        expect(points[0]).toEqual(
            expect.objectContaining({
                kind: "inside_contradiction",
                severity: "high",
                line: say("inside.line", { label: fx.inside.label }),
                why: say("inside.why", { a: fx.inside.a, b: fx.inside.b }),
                question: say("inside.question", { label: fx.inside.label }),
            }),
        )
        expect(points[0]?.quotes.map((quote) => [quote.text, quote.factId])).toEqual([
            [fx.inside.quoteFirst, "f30"],
            [fx.inside.quoteSecond, "f25"],
        ])
        expect(points[0]?.choices.map((choice) => [choice.label, choice.answer.kind, choice.answer.factId])).toEqual([
            [fx.inside.a, "pick", "f30"],
            [fx.inside.b, "pick", "f25"],
        ])
    })

    it("typo: the same item a power of ten apart inside the document", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(inputOf([fx.slip.first, fx.slip.second]))
        expect(points.map((point) => [point.kind, point.line])).toEqual([["typo", say("slip.line", { label: fx.slip.label })]])
    })

    it("shop_contradiction against a truth in force on the same key; typo when a power of ten apart; other_document against a waiting proposal; nothing for a candidate found only by meaning", async () => {
        const { criticRules: rules } = await buildSubject()
        const hash = passageTextHashOf(fx.shop.text)
        const mine = [
            fact("g", { quote: fx.shop.basketQuote, chunkHash: hash }),
            fact("s", { subjectLabel: fx.shop.ship, subjectKey: "ship", attributeLabel: fx.shop.fee, attribute: "phi", value: fx.shop.shipValue, chunkHash: hash }),
            fact("b", { subjectLabel: fx.shop.rose, subjectKey: "bo-hoa-hong-do-10-bong", value: fx.shop.roseValue, chunkHash: hash }),
            fact("h", { subjectLabel: fx.shop.shopName, subjectKey: "tiem", attributeLabel: fx.shop.hours, attribute: "gio-mo-cua", value: fx.shop.hoursValue, chunkHash: hash }),
        ]
        const candidate = (of: CriticFact, match: "key" | "vector", sourceTitle: string): CriticCandidate => ({ fact: of, distance: null, match, sourceTitle })
        const candidates = new Map<string, ReadonlyArray<CriticCandidate>>([
            ["g", [candidate(fact("seed", { value: fx.shop.seedValue, status: "active" }), "key", fx.shop.seedTitle)]],
            ["s", [candidate(fact("ship", { subjectKey: "ship", attribute: "phi", value: fx.shop.shipTruth, status: "active" }), "key", fx.shop.shipTitle)]],
            ["h", [candidate(fact("h2", { value: fx.shop.hoursOther, status: "proposed" }), "key", fx.shop.hoursTitle)]],
            ["b", [candidate(fact("b2", { subjectLabel: fx.shop.roseOther, value: fx.shop.roseTruth, status: "active" }), "vector", fx.shop.seedTitle)]],
        ])
        const points = rules(inputOf([fx.shop.text], { facts: mine, candidates }))
        const where = (title: string): string => ` (${title})`
        expect(points.map((point) => [point.kind, point.severity, point.against?.kind, point.why])).toEqual([
            ["shop_contradiction", "high", "truth", say("shop.why", { label: `${fx.shop.basket} · ${fx.shop.price}`, value: fx.shop.basketValue, other: fx.shop.seedValue, where: where(fx.shop.seedTitle) })],
            ["typo", "high", "truth", say("typo.why_truth", { label: `${fx.shop.ship} · ${fx.shop.fee}`, value: fx.shop.shipValue, other: fx.shop.shipTruth, where: where(fx.shop.shipTitle) })],
            ["other_document", "medium", "proposal", say("other.why_titled", { label: `${fx.shop.shopName} · ${fx.shop.hours}`, value: fx.shop.hoursValue, other: fx.shop.hoursOther, where: where(fx.shop.hoursTitle), title: fx.shop.hoursTitle })],
        ])
        expect(points[0]?.choices.map((choice) => [choice.label, choice.answer.kind, choice.answer.factId])).toEqual([
            [say("choice.by_file_value", { value: fx.shop.basketValue }), "keep_document", "g"],
            [say("choice.by_shop", { value: fx.shop.seedValue }), "keep_shop", "seed"],
        ])
        expect(points[1]?.choices.map((choice) => [choice.answer.kind, choice.answer.value])).toEqual([
            ["value", fx.shop.shipTruth],
            ["keep_document", fx.shop.shipValue],
        ])
    })

    it("vague: a rule that promises money with no amount, not a rule with its amount, not a rule with no money", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(inputOf([fx.vague.old, fx.vague.new, fx.vague.cash]))
        expect(points.map((point) => [point.kind, point.line, point.question])).toEqual([
            ["vague", say("vague.line", { name: fx.vague.name }), say("vague.question", { name: fx.vague.name })],
        ])
        expect(points[0]?.choices.map((choice) => [choice.needsInput, choice.answer.kind])).toEqual([
            [true, "value"],
            [false, "remove"],
        ])
        expect(points[0]?.target).toEqual({ subjectLabel: fx.vague.name, attributeLabel: say("target.extra") })
    })

    it("template: a blank price left in (bracketed, or dots that normalisation shortened) and the name of a template shop", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(inputOf([fx.template.prices, fx.template.abc]))
        expect(points.map((point) => [point.kind, point.line, point.why])).toEqual([
            ["template", say("template.line_blank", { name: fx.template.stand }), say("template.why_blank", { blank: fx.template.bracket })],
            ["template", say("template.line_blank", { name: fx.template.fruit }), say("template.why_blank", { blank: fx.template.dots })],
            ["template", say("template.line_template", { name: fx.template.abcLine }), say("template.why_template", { blank: fx.template.abcText })],
        ])
    })

    it("stale_date: an offer already ended (high), a closing already past (low), a day that does not exist (high); a future date is fine", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(inputOf([fx.stale.offer, fx.stale.closing, fx.stale.impossible, fx.stale.future]))
        expect(points.map((point) => [point.kind, point.severity, point.line])).toEqual([
            ["stale_date", "high", say("stale.line_past", { date: "30/06/2026" })],
            ["stale_date", "low", say("stale.line_past", { date: "20/02/2026" })],
            ["stale_date", "high", say("stale.line_impossible", { date: "31/02/2027" })],
        ])
    })

    it("arithmetic: a total that is not the sum of its parts, with the sum as a choice", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(inputOf([fx.arithmetic.text]))
        expect(points.map((point) => [point.kind, point.why])).toEqual([
            ["arithmetic", say("arithmetic.why", { name: fx.arithmetic.name, sum: fx.arithmetic.sum, stated: fx.arithmetic.stated })],
        ])
        expect(points[0]?.choices[0]?.answer).toEqual({ kind: "value", factId: null, value: fx.arithmetic.sum })
    })

    it("missing: a price fact with no amount", async () => {
        const { criticRules: rules } = await buildSubject()
        const points = rules(
            inputOf([fx.missing.text], { facts: [fact("l", { subjectLabel: fx.missing.subject, subjectKey: "lan-ho-diep", value: fx.missing.value })] }),
        )
        expect(points.map((point) => [point.kind, point.line])).toEqual([
            ["missing", say("missing.line", { label: `${fx.missing.subject} · ${fx.shop.price}` })],
        ])
    })
})
