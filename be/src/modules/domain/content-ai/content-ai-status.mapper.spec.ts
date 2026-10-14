import { toContentAiReview } from "./content-ai-status.mapper"

describe("toContentAiReview", () => {
    it("preserves a promise finding and normalizes unrelated fields to null", () => {
        expect(
            toContentAiReview({ channel: "facebook", warning: { kind: "promise", phrase: "Guaranteed results" } }),
        ).toEqual({
            channel: "facebook",
            warning: { kind: "promise", phrase: "Guaranteed results", figure: null, length: null, max: null },
        })
    })

    it("preserves a figure finding and normalizes unrelated fields to null", () => {
        expect(toContentAiReview({ channel: "zalo", warning: { kind: "figure", figure: "95%" } })).toEqual({
            channel: "zalo",
            warning: { kind: "figure", phrase: null, figure: "95%", length: null, max: null },
        })
    })

    it("preserves both length limits and normalizes unrelated fields to null", () => {
        expect(toContentAiReview({ channel: "facebook", warning: { kind: "length", length: 201, max: 200 } })).toEqual({
            channel: "facebook",
            warning: { kind: "length", phrase: null, figure: null, length: 201, max: 200 },
        })
    })
})
