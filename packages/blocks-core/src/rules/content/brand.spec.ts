import { STARTER_BRAND, brandBlockOf, brandCadenceShape, brandPillarsShape, cleanHashtags } from "./brand"

describe("the content brand", () => {
    it("keeps the starter themes and rhythm in the entity's own shapes", () => {
        expect(brandPillarsShape.safeParse({ items: STARTER_BRAND.pillars }).success).toBe(true)
        expect(brandCadenceShape.safeParse({ items: STARTER_BRAND.cadence }).success).toBe(true)
    })

    it("refuses a rhythm that names a channel twice or a time that is none", () => {
        const twice = { items: [STARTER_BRAND.cadence[0], STARTER_BRAND.cadence[0]] }
        expect(brandCadenceShape.safeParse(twice).success).toBe(false)
        const late = { items: [{ channel: "zalo", postsPerWeek: 1, days: [], time: "25:00" }] }
        expect(brandCadenceShape.safeParse(late).success).toBe(false)
    })

    it("cleans hashtags: one # each, split on spaces and commas, no repeat", () => {
        expect(cleanHashtags(["#hoa tuoi, ##hoa", "tuoi"])).toEqual(["#hoa", "#tuoi"])
    })

    it("writes the brand block with the default voice and the active themes only", () => {
        const block = brandBlockOf({
            ...STARTER_BRAND,
            pillars: [
                { name: "A", description: "", weight: 1, active: true },
                { name: "B", description: "b", weight: 1, active: false },
            ],
        })
        expect(block).toContain("Brand voice: friendly, clear, useful, and restrained.")
        expect(block).toContain("Themes: A")
        expect(block).not.toContain("B (b)")
    })
})
