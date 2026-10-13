import type { MatchItem, MatchRecipe } from "../inventory.contracts"
import { matchOrderLine, parseOrderLines } from "./order-lines.policy"

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
    it("reads a leading quantity", () => {
        expect(parseOrderLines("2 milk coffee")).toEqual([{ raw: "2 milk coffee", qty: 2, name: "milk coffee" }])
    })

    it("reads a leading quantity with a multiplier sign", () => {
        expect(parseOrderLines(`3x tea; 4 ${TIMES} cake`)).toEqual([
            { raw: "3x tea", qty: 3, name: "tea" },
            { raw: `4 ${TIMES} cake`, qty: 4, name: "cake" },
        ])
    })

    it("keeps an x that belongs to the name", () => {
        expect(parseOrderLines("5 xe gach")).toEqual([{ raw: "5 xe gach", qty: 5, name: "xe gach" }])
    })

    it("reads a trailing quantity", () => {
        expect(parseOrderLines("tea x3")).toEqual([{ raw: "tea x3", qty: 3, name: "tea" }])
        expect(parseOrderLines("tea: 2,5")).toEqual([{ raw: "tea: 2,5", qty: 2.5, name: "tea" }])
        expect(parseOrderLines(`tea ${TIMES}4`)).toEqual([{ raw: `tea ${TIMES}4`, qty: 4, name: "tea" }])
    })

    it("counts a line without a number as one", () => {
        expect(parseOrderLines("black coffee")).toEqual([{ raw: "black coffee", qty: 1, name: "black coffee" }])
    })

    it("counts a zero quantity as one", () => {
        expect(parseOrderLines("0 tea")).toEqual([{ raw: "0 tea", qty: 1, name: "tea" }])
        expect(parseOrderLines("tea x0")).toEqual([{ raw: "tea x0", qty: 1, name: "tea" }])
    })

    it("splits on line breaks, semicolons, commas, plus signs and the word and, and drops bullets", () => {
        const lines = parseOrderLines(`- 1 tea\n${BULLET} 2 cake, 3 juice + 1 water v${A_GRAVE} 1 bread`)
        expect(lines.map((line) => line.raw)).toEqual(["1 tea", "2 cake", "3 juice", "1 water", "1 bread"])
    })

    it("does not split a decimal comma", () => {
        expect(parseOrderLines("1,5 kg rice")).toEqual([{ raw: "1,5 kg rice", qty: 1.5, name: "kg rice" }])
    })

    it("answers nothing for an empty text", () => {
        expect(parseOrderLines("  \n ")).toEqual([])
    })
})

describe("matchOrderLine", () => {
    const line = (name: string, qty = 1) => ({ raw: name, qty, name })

    it("matches an item by its name", () => {
        expect(matchOrderLine(line("beer", 2), [], [itemOf({})])).toEqual({ kind: "item", id: "item-1", qty: 2 })
    })

    it("matches an item by its sku or an alias", () => {
        expect(matchOrderLine(line("bia"), [], [itemOf({ aliases: ["bia"] })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
        expect(matchOrderLine(line("beer"), [], [itemOf({ name: "Lager", sku: "BEER" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })

    it("matches a recipe and prefers it to an item of the same name", () => {
        const match = matchOrderLine(
            line("milk coffee", 2),
            [recipeOf({})],
            [itemOf({ id: "item-2", name: "Milk coffee" })],
        )
        expect(match).toEqual({ kind: "recipe", id: "recipe-1", qty: 2 })
    })

    it("matches a recipe by an alias", () => {
        expect(matchOrderLine(line("ca phe sua"), [recipeOf({ aliases: ["ca phe sua"] })], [])).toEqual({
            kind: "recipe",
            id: "recipe-1",
            qty: 1,
        })
    })

    it("matches an item whose name sits inside a longer order text", () => {
        expect(matchOrderLine(line("cold beer please"), [], [itemOf({})])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })

    it("matches a longer item name that contains a long enough order text", () => {
        expect(matchOrderLine(line("lager"), [], [itemOf({ name: "Cold lager" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })

    it("keeps the best score when two items match", () => {
        const items = [itemOf({ id: "loose", name: "tea" }), itemOf({ id: "exact", name: "green tea", sku: "GT" })]
        expect(matchOrderLine(line("green tea"), [], items)).toEqual({ kind: "item", id: "exact", qty: 1 })
    })

    it("scales the quantity by the conversion of a leading unit word", () => {
        const item = itemOf({ units: [{ unit: "box", factor: 24 }] })
        expect(matchOrderLine(line("box beer", 2), [], [item])).toEqual({ kind: "item", id: "item-1", qty: 48 })
    })

    it("treats a generic unit word as a unit with no conversion", () => {
        expect(matchOrderLine(line("chai beer", 3), [], [itemOf({})])).toEqual({ kind: "item", id: "item-1", qty: 3 })
    })

    it("tries the whole text when the text without the unit word matches nothing", () => {
        const item = itemOf({ name: "chai tea", sku: "CT" })
        expect(matchOrderLine(line("chai tea"), [], [item])).toEqual({ kind: "item", id: "item-1", qty: 1 })
    })

    it("skips an empty text left after the unit word", () => {
        expect(matchOrderLine(line("chai"), [], [itemOf({ name: "chai", sku: "CH" })])).toEqual({
            kind: "item",
            id: "item-1",
            qty: 1,
        })
    })

    it("answers null when nothing matches", () => {
        expect(matchOrderLine(line("unknown"), [recipeOf({})], [itemOf({})])).toBeNull()
    })

    it("ignores an item with an empty alias", () => {
        expect(matchOrderLine(line("unknown"), [], [itemOf({ aliases: [""] })])).toBeNull()
    })
})
