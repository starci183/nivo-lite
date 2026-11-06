import { DETAIL_FIXTURE_RECORD, detailFixtureProps, detailFixtures } from "../fixtures/detail.fixtures"
import { detailSectionsOf } from "../rows/detail-sections"
import { DETAIL_SECTIONS_MAX, detailBlock } from "./detail.block"

const WORD = { key: "word" }
const FACT = { term: WORD, path: "total" }
const DETAIL = { label: WORD, items: [FACT] }
const accepts = (props: unknown): boolean => detailBlock.props.safeParse(props).success

describe("detailBlock", () => {
    it("is the core.detail block, with no children", () => {
        expect(detailBlock.id).toBe("core.detail")
        expect(detailBlock.children).toBe(false)
        expect(Object.keys(detailBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("reads one record and offers a primary and a secondary action, both optional", () => {
        expect(detailBlock.slots).toEqual({
            record: { kind: "read", shape: "record", required: true },
            primary: { kind: "action", required: false },
            secondary: { kind: "action", required: false },
        })
    })

    it("still takes a label and term and path facts", () => {
        expect(accepts(DETAIL)).toBe(true)
        expect(accepts(detailFixtureProps)).toBe(true)
    })

    it("takes a format on a fact, titled sections, an idle notice, an id path and a currency", () => {
        expect(accepts({ ...DETAIL, items: [{ ...FACT, format: "money" }] })).toBe(true)
        expect(accepts({ ...DETAIL, sections: [{ title: WORD, items: [FACT] }, { items: [FACT] }] })).toBe(true)
        expect(accepts({ ...DETAIL, idle: WORD, idPath: "uuid", currency: "USD" })).toBe(true)
    })

    it("refuses a format that is not one, a path or list past its bound, and too many sections", () => {
        expect(accepts({ ...DETAIL, items: [{ ...FACT, format: "html" }] })).toBe(false)
        expect(accepts({ ...DETAIL, items: [{ ...FACT, path: "p".repeat(201) }] })).toBe(false)
        expect(accepts({ ...DETAIL, items: Array.from({ length: 51 }, () => FACT) })).toBe(false)
        expect(accepts({ ...DETAIL, sections: [{ items: Array.from({ length: 51 }, () => FACT) }] })).toBe(false)
        expect(
            accepts({ ...DETAIL, sections: Array.from({ length: DETAIL_SECTIONS_MAX + 1 }, () => ({ items: [] })) }),
        ).toBe(false)
        expect(accepts({ ...DETAIL, currency: "dong" })).toBe(false)
    })
})

describe("detailFixtures", () => {
    it("holds every status of the record read", () => {
        expect(Object.keys(detailFixtures)).toEqual(["ready", "empty", "error", "loading", "forbidden"])
    })

    it("lists the sample record through its sections", () => {
        const sections = detailSectionsOf(DETAIL_FIXTURE_RECORD, detailFixtureProps, {
            locale: "vi",
            currency: "VND",
            timeZone: "UTC",
        })
        expect(sections.map((section) => section.items.length)).toEqual([2, 3])
        expect(sections[1]?.items[2]?.text).toBe("Lan")
    })

    it("takes a head over the record, a timeline of its steps and a pinned primary, and refuses a bad close param", () => {
        const base = { label: { key: "word" }, items: [] }
        const timeline = { title: { key: "word" }, listPath: "origin", textPath: "text", notePath: "by", atPath: "at" }
        expect(accepts({ ...base, titlePath: "title", kind: { key: "word" }, closeParam: "entry" })).toBe(true)
        expect(accepts({ ...base, timeline, pinsPrimary: true })).toBe(true)
        expect(accepts({ ...base, closeParam: "not a name" })).toBe(false)
        expect(accepts({ ...base, timeline: { ...timeline, textPath: undefined } })).toBe(false)
        expect(detailBlock.params).toEqual(["closeParam"])
    })
})
