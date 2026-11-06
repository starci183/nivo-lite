import { FIGURE_FORMATS, FIGURE_KINDS } from "../rows/figure-format"
import { figuresBlock } from "./figures.block"

const WORD = { key: "word" }
const ITEM = { term: WORD, path: "total" }
const FIGURES = { label: WORD, items: [ITEM] }
const accepts = (props: unknown): boolean => figuresBlock.props.safeParse(props).success

describe("figuresBlock", () => {
    it("is the core.figures block over one required record, with no children", () => {
        expect(figuresBlock.id).toBe("core.figures")
        expect(figuresBlock.children).toBe(false)
        expect(figuresBlock.slots).toEqual({ data: { kind: "read", shape: "record", required: true } })
    })

    it("takes figures with no format, as before", () => {
        expect(accepts(FIGURES)).toBe(true)
    })

    it("takes every format on an item and refuses another", () => {
        expect(FIGURE_FORMATS.every((format) => accepts({ ...FIGURES, items: [{ ...ITEM, format }] }))).toBe(true)
        expect(accepts({ ...FIGURES, items: [{ ...ITEM, format: "date" }] })).toBe(false)
        expect(accepts({ ...FIGURES, items: [{ ...ITEM, format: "html" }] })).toBe(false)
    })

    it("takes the path of the caption under a chart", () => {
        expect(accepts({ ...FIGURES, kind: "bars", captionPath: "caption" })).toBe(true)
        expect(accepts({ ...FIGURES, captionPath: "p".repeat(201) })).toBe(false)
    })

    it("takes the path of the line under a value", () => {
        expect(accepts({ ...FIGURES, items: [{ ...ITEM, hintPath: "note" }] })).toBe(true)
        expect(accepts({ ...FIGURES, items: [{ ...ITEM, hintPath: "p".repeat(201) }] })).toBe(false)
    })

    it("takes the currency of its money and refuses one that is no ISO code", () => {
        expect(accepts({ ...FIGURES, currency: "USD" })).toBe(true)
        expect(accepts({ ...FIGURES, currency: "dong" })).toBe(false)
    })
    it("takes every kind and refuses another", () => {
        expect(FIGURE_KINDS.every((kind) => accepts({ ...FIGURES, kind }))).toBe(true)
        expect(accepts({ ...FIGURES, kind: "pie" })).toBe(false)
    })
})
