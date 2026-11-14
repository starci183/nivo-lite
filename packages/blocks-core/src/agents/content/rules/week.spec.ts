import { fillTemplate, lastWeekOf, weekSummaryOf } from "./week"

describe("the weekly report", () => {
    it("reports the last whole week, Monday to Sunday", () => {
        expect(lastWeekOf("2026-11-16")).toEqual({ from: "2026-11-09", to: "2026-11-15" })
        expect(lastWeekOf("2026-11-22")).toEqual({ from: "2026-11-09", to: "2026-11-15" })
    })

    it("counts only the posts planned for the week, by state and channel", () => {
        const summary = weekSummaryOf({ from: "2026-11-09", to: "2026-11-15" }, [
            { status: "published", channel: "facebook", day: "2026-11-10" },
            { status: "approved", channel: "zalo", day: "2026-11-15" },
            { status: "draft", channel: "facebook", day: "2026-11-16" },
            { status: "draft", channel: "facebook", day: null },
        ])
        expect(summary).toEqual({
            from: "2026-11-09",
            to: "2026-11-15",
            planned: 2,
            drafts: 0,
            approved: 1,
            published: 1,
            byChannel: { facebook: 1, zalo: 1, tiktok: 0, instagram: 0 },
        })
    })

    it("fills the places of a template and keeps a place with no value", () => {
        expect(fillTemplate("{a} and {b}", { a: 1 })).toBe("1 and {b}")
    })
})
