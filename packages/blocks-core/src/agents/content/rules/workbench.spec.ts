import type { RecordRow } from "@nivo-lite/agent-sdk/entity/port"
import { STARTER_BRAND } from "./brand"
import { brandFormOf, brandOfForm, brandOfRow, postViewOf, pillarOfLine, weekdaysOf } from "./workbench"

/** A record of the store with the given id and data. */
const rowOf = (id: string, data: Readonly<Record<string, unknown>>): RecordRow => ({
    id,
    workspaceId: "w1",
    version: "1",
    createdAt: "2026-11-13T01:00:00.000Z",
    updatedAt: "2026-11-13T01:00:00.000Z",
    data,
})

describe("the content workbench rules", () => {
    it("shows a post record with its flags for the detail's two actions", () => {
        const view = postViewOf(
            rowOf("p1", {
                title: "A",
                channel: "zalo",
                status: "approved",
                day: "2026-11-19",
                publishResult: { postId: null, url: "https://x" },
            }),
        )
        expect(view).toMatchObject({ id: "p1", channel: "zalo", status: "approved", isDraft: false, isApproved: true, url: "https://x" })
        expect(view.hasMedia).toBe(false)
    })

    it("reads the starter brand for no record and a saved brand's own themes", () => {
        expect(brandOfRow(null)).toEqual(STARTER_BRAND)
        const row = rowOf("b1", { voice: "Vui", pillars: { items: [] }, cadence: { items: [] } })
        expect(brandOfRow(row)).toMatchObject({ voice: "Vui", pillars: [], cadence: [] })
    })

    it("round-trips the brand through its form", () => {
        const form = brandFormOf("b1", STARTER_BRAND)
        expect(form.facebookPosts).toBe(3)
        expect(form.facebookDays).toBe("2,4,6")
        const { id: _id, ...given } = form
        const parsed = brandOfForm(given)
        expect(parsed).toEqual({ ok: true, brand: STARTER_BRAND })
    })

    it("reads a theme line, its weight 1 by default and 0 as paused", () => {
        expect(pillarOfLine("Hoa")).toEqual({ name: "Hoa", description: "", weight: 1, active: true })
        expect(pillarOfLine("Flowers | fresh | 0")).toEqual({ name: "Flowers", description: "fresh", weight: 0, active: false })
        expect(pillarOfLine(" | x")).toBeNull()
        expect(pillarOfLine("Hoa | | 11")).toBeNull()
    })

    it("refuses a form whose weekdays or time are none, by field", () => {
        const { id: _id, ...given } = brandFormOf("", STARTER_BRAND)
        const parsed = brandOfForm({ ...given, zaloDays: "8", zaloTime: "late" })
        expect(parsed).toEqual({
            ok: false,
            problems: [
                { field: "zaloDays", issue: "days_invalid" },
                { field: "zaloTime", issue: "time_invalid" },
            ],
        })
        expect(weekdaysOf("5, 1,1")).toEqual([1, 5])
    })
})
