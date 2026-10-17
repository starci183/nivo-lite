import { Test } from "@nestjs/testing"
import type { MatchItem, MatchRecipe } from "../inventory.contracts"
import { matchOrderLine, parseOrderLines } from "./order-lines.policy"

const SUBJECT = Symbol("order-lines.policy")

const buildSubject = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { parseOrderLines, matchOrderLine } }],
    }).compile()
    return moduleRef.get<typeof import("./order-lines.policy")>(SUBJECT)
}

const A_GRAVE = String.fromCodePoint(0xe0)
const TIMES = String.fromCodePoint(0xd7)
const BULLET = String.fromCodePoint(0x2022)

const itemOf = (overrides: Partial<MatchItem>): MatchItem => ({
    id: "item-1",
    sku: "BEER",
    name: "Beer",
    unit: "can",
    units: [],
    aliases: [],
    ...overrides,
})

const recipeOf = (overrides: Partial<MatchRecipe>): MatchRecipe => ({
    id: "recipe-1",
    name: "Milk coffee",
    aliases: [],
    ...overrides,
})

describe("parseOrderLines", () => {
    it("reads a leading quantity", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("2 milk coffee")).toEqual([
            { raw: "2 milk coffee", qty: 2, name: "milk coffee" },
        ])
    })

    it("reads a leading quantity with a multiplier sign", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines(`3x tea; 4 ${TIMES} cake`)).toEqual([
            { raw: "3x tea", qty: 3, name: "tea" },
            { raw: `4 ${TIMES} cake`, qty: 4, name: "cake" },
        ])
    })

    it("keeps an x that belongs to the name", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("5 xe gach")).toEqual([{ raw: "5 xe gach", qty: 5, name: "xe gach" }])
    })

    it("reads a trailing quantity", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("tea x3")).toEqual([{ raw: "tea x3", qty: 3, name: "tea" }])
        expect(subject.parseOrderLines("tea: 2,5")).toEqual([{ raw: "tea: 2,5", qty: 2.5, name: "tea" }])
        expect(subject.parseOrderLines(`tea ${TIMES}4`)).toEqual([{ raw: `tea ${TIMES}4`, qty: 4, name: "tea" }])
    })

    it("counts a line without a number as one", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("black coffee")).toEqual([{ raw: "black coffee", qty: 1, name: "black coffee" }])
    })

    it("counts a zero quantity as one", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("0 tea")).toEqual([{ raw: "0 tea", qty: 1, name: "tea" }])
        expect(subject.parseOrderLines("tea x0")).toEqual([{ raw: "tea x0", qty: 1, name: "tea" }])
    })

    it("splits on line breaks, semicolons, commas, plus signs and the word and, and drops bullets", async () => {
        const subject = await buildSubject()

        const lines = subject.parseOrderLines(`- 1 tea\n${BULLET} 2 cake, 3 juice + 1 water v${A_GRAVE} 1 bread`)
        expect(lines.map((line) => line.raw)).toEqual(["1 tea", "2 cake", "3 juice", "1 water", "1 bread"])
    })

    it("does not split a decimal comma", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("1,5 kg rice")).toEqual([{ raw: "1,5 kg rice", qty: 1.5, name: "kg rice" }])
    })

    it("answers nothing for an empty text", async () => {
        const subject = await buildSubject()

        expect(subject.parseOrderLines("  \n ")).toEqual([])
    })
})

describe("matchOrderLine", () => {
    const line = (name: string, qty = 1) => ({ raw: name, qty, name })
    it("matches an item by its name", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("beer", 2), [], [itemOf({})])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 2,
        })
    })
    it("matches an item by its sku or an alias", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("bia"), [], [itemOf({ aliases: ["bia"] })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
        expect(subject.matchOrderLine(line("beer"), [], [itemOf({ name: "Lager", sku: "BEER" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })
    it("matches a recipe and prefers it to an item of the same name", async () => {
        const subject = await buildSubject()
        const match = subject.matchOrderLine(
            line("milk coffee", 2),
            [recipeOf({})],
            [itemOf({ id: "item-2", name: "Milk coffee" })],
        )
        expect(match).toEqual({ kind: "recipe", id: "recipe-1", qty: 2 })
    })
    it("matches a recipe by an alias", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("ca phe sua"), [recipeOf({ aliases: ["ca phe sua"] })], [])).toEqual({
            kind: "recipe",
            id: "recipe-1",
            qty: 1,
        })
    })
    it("matches an item whose name sits inside a longer order text", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("cold beer please"), [], [itemOf({})])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })
    it("matches a longer item name that contains a long enough order text", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("lager"), [], [itemOf({ name: "Cold lager" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })
    it("keeps the best score when two items match", async () => {
        const subject = await buildSubject()
        const items = [itemOf({ id: "loose", name: "tea" }), itemOf({ id: "exact", name: "green tea", sku: "GT" })]
        expect(subject.matchOrderLine(line("green tea"), [], items)).toEqual({ kind: "item", id: "exact", qty: 1 })
    })
})

describe("matchOrderLine with a leading unit word", () => {
    const line = (name: string, qty = 1) => ({ raw: name, qty, name })
    it("scales the quantity by the conversion of a leading unit word", async () => {
        const subject = await buildSubject()
        const item = itemOf({ units: [{ unit: "box", factor: 24 }] })
        expect(subject.matchOrderLine(line("box beer", 2), [], [item])).toEqual({ kind: "item", id: "item-1", qty: 48 })
    })
    it("treats a generic unit word as a unit with no conversion", async () => {
        const subject = await buildSubject()
        expect(subject.matchOrderLine(line("chai beer", 3), [], [itemOf({})])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 3,
        })
    })

    it("tries the whole text when the text without the unit word matches nothing", async () => {
        const subject = await buildSubject()

        const item = itemOf({ name: "chai tea", sku: "CT" })
        expect(subject.matchOrderLine(line("chai tea"), [], [item])).toEqual({ kind: "item", id: "item-1", qty: 1 })
    })
})

describe("matchOrderLine", () => {
    const line = (name: string, qty = 1) => ({ raw: name, qty, name })
    it("skips an empty text left after the unit word", async () => {
        const subject = await buildSubject()

        expect(subject.matchOrderLine(line("chai"), [], [itemOf({ name: "chai", sku: "CH" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })

    it("answers null when nothing matches", async () => {
        const subject = await buildSubject()

        expect(subject.matchOrderLine(line("unknown"), [recipeOf({})], [itemOf({})])).toBeNull()
    })

    it("ignores an item with an empty alias", async () => {
        const subject = await buildSubject()

        expect(subject.matchOrderLine(line("unknown"), [], [itemOf({ aliases: [""] })])).toBeNull()
    })
})
