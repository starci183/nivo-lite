import { ASIDE_WIDTHS, asideDetailBlock } from "./aside-detail.block"

describe("asideDetailBlock", () => {
    it("is the core.aside-detail block, holding a main and an aside and binding nothing", () => {
        expect(asideDetailBlock.id).toBe("core.aside-detail")
        expect(asideDetailBlock.children).toEqual({ max: 2 })
        expect(asideDetailBlock.slots).toEqual({})
        expect(Object.keys(asideDetailBlock.propsJson).length).toBeGreaterThan(0)
    })

    it("takes no props, or the width of the aside", () => {
        expect(asideDetailBlock.props.safeParse({}).success).toBe(true)
        expect(ASIDE_WIDTHS.every((width) => asideDetailBlock.props.safeParse({ width }).success)).toBe(true)
    })

    it("refuses a width that is not one of the Grammar's", () => {
        expect(asideDetailBlock.props.safeParse({ width: "huge" }).success).toBe(false)
    })
})
