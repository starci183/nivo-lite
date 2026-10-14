import { contentInstant, toContentItem } from "./content-editor.mapper"
import type { ContentEditorRow } from "./persistence/content-editor.rows"

const storedRow = (): ContentEditorRow => ({
    id: "post",
    workspace_id: "workspace",
    plan_id: "plan",
    title: "Launch",
    brief: "Brief",
    pillar_id: "pillar",
    channels: ["facebook", "unsupported", "zalo"],
    scheduled_at: new Date("2026-10-15T00:00:00.000Z"),
    status: "approved",
    variants: { facebook: { text: "Draft", hashtags: ["launch"], note: "Note" } },
    hashtags: ["shared"],
    media: [{ kind: "media", name: "Photo", path: "workspace/photo.png", suggested: true }],
    links: [{ url: "https://example.test", label: "Source" }],
    holiday_key: "holiday",
    evidence: [{ at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" }],
    published: { facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" } },
    work_item_id: "approval",
    drafted_at: "2026-10-12T00:00:00.000Z",
    approved_by: "Approver",
    approved_at: new Date("2026-10-13T00:00:00.000Z"),
    published_at: null,
    source: "plan",
    created_by: "Author",
    created_at: new Date("2026-10-11T00:00:00.000Z"),
    updated_at: "2026-10-14T00:00:00.000Z",
})

describe("content editor row mapping", () => {
    it("serializes Date timestamps and preserves driver strings", () => {
        expect(contentInstant(new Date("2026-10-14T01:02:03.456Z"))).toBe("2026-10-14T01:02:03.456Z")
        expect(contentInstant("driver timestamp")).toBe("driver timestamp")
    })

    it("preserves every editor, publication, audit and approval field", () => {
        expect(toContentItem(storedRow())).toEqual({
            id: "post",
            workspaceId: "workspace",
            planId: "plan",
            title: "Launch",
            brief: "Brief",
            pillarId: "pillar",
            channels: ["facebook", "zalo"],
            scheduledAt: "2026-10-15T00:00:00.000Z",
            status: "approved",
            variants: { facebook: { text: "Draft", hashtags: ["launch"], note: "Note" } },
            hashtags: ["shared"],
            media: [{ kind: "media", name: "Photo", path: "workspace/photo.png", id: undefined, suggested: true }],
            links: [{ url: "https://example.test", label: "Source" }],
            holidayKey: "holiday",
            evidence: [{ at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" }],
            published: {
                facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" },
            },
            workItemId: "approval",
            draftedAt: "2026-10-12T00:00:00.000Z",
            approvedBy: "Approver",
            approvedAt: "2026-10-13T00:00:00.000Z",
            publishedAt: null,
            source: "plan",
            createdBy: "Author",
            createdAt: "2026-10-11T00:00:00.000Z",
            updatedAt: "2026-10-14T00:00:00.000Z",
        })
    })

    it("defaults unsupported channels, lifecycle state and source", () => {
        const row = { ...storedRow(), channels: ["unknown"], status: "unknown", source: "unknown" }
        expect(toContentItem(row)).toEqual({
            ...toContentItem(storedRow()),
            channels: ["facebook"],
            status: "idea",
            source: "manual",
        })
    })
})
