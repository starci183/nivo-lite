import { BRAIN_FACT_FIELDS_POINTER, BRAIN_FACT_LEGEND, BRAIN_FACT_MODEL_NOTES, TOOL } from "./index"

describe("the legend of a served truth", () => {
    it("names every compact field a Brain read serves", () => {
        for (const field of ["num =", "src", "v =", "from/to", "now =", "pub", "disputed", "next"]) expect(BRAIN_FACT_LEGEND).toContain(field)
    })

    it("is written once on the truth search; the other truth reads point at it", () => {
        expect(BRAIN_FACT_LEGEND).toContain("nivo.tool.brain.*")
        expect(BRAIN_FACT_FIELDS_POINTER).toBe(`Fact fields as in ${TOOL.brainSearch}.`)
        expect(BRAIN_FACT_MODEL_NOTES).toEqual({
            toolBrainSearch: BRAIN_FACT_LEGEND,
            toolBrainFactGet: BRAIN_FACT_FIELDS_POINTER,
            toolBrainFactRelated: BRAIN_FACT_FIELDS_POINTER,
        })
    })
})
