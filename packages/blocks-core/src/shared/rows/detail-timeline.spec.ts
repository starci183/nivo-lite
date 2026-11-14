import { cellContextOf } from "./cell-format"
import { detailTimelineOf } from "./detail-timeline"

const context = cellContextOf("en-US", "USD")
const spec = { title: { key: "origin" }, listPath: "origin", textPath: "text", notePath: "by", atPath: "at" }

describe("detailTimelineOf", () => {
    it("lists the steps in order with their note and time", () => {
        const steps = detailTimelineOf(
            { origin: [{ text: "Asked for a quote", by: "Zalo", at: "2026-11-03T10:30:00Z" }, { text: "Quote sent" }] },
            spec,
            context,
        )
        expect(steps.map((step) => step.text)).toEqual(["Asked for a quote", "Quote sent"])
        expect(steps[0]?.note).toBe("Zalo")
        expect(steps[0]?.at).not.toBe("")
        expect(steps[1]).toEqual({ id: "1", text: "Quote sent", note: "", at: "" })
    })

    it("draws no time and no note when the spec names no path for them", () => {
        const steps = detailTimelineOf(
            { origin: [{ text: "Asked", at: "2026-11-03T10:30:00Z" }] },
            {
                title: spec.title,
                listPath: "origin",
                textPath: "text",
            },
            context,
        )
        expect(steps).toEqual([{ id: "0", text: "Asked", note: "", at: "" }])
    })

    it("leaves out a step without words and returns nothing when the record holds no list", () => {
        expect(detailTimelineOf({ origin: [{ by: "x" }, { text: "" }] }, spec, context)).toEqual([])
        expect(detailTimelineOf({ origin: "none" }, spec, context)).toEqual([])
        expect(detailTimelineOf(null, spec, context)).toEqual([])
    })
})
