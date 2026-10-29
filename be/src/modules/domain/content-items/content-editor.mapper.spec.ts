import { Test } from "@nestjs/testing"
import { contentInstant, toContentItem } from "./content-editor.mapper"
import { ContentItemEntity } from "./persistence/entities"

const SUBJECT = Symbol("content-editor.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { contentInstant, toContentItem } }],
    }).compile()
    return moduleRef.get<typeof import("./content-editor.mapper")>(SUBJECT)
}

const storedRow = (): ContentItemEntity =>
    Object.assign(new ContentItemEntity(), {
        id: "post",
        workspaceId: "workspace",
        planId: "plan",
        title: "Launch",
        brief: "Brief",
        pillarId: "pillar",
        channels: ["facebook", "unsupported", "zalo"],
        scheduledAt: new Date("2026-10-15T00:00:00.000Z"),
        status: "approved",
        variants: { facebook: { text: "Draft", hashtags: ["launch"], note: "Note" } },
        hashtags: ["shared"],
        media: [{ kind: "media", name: "Photo", path: "workspace/photo.png", suggested: true }],
        links: [{ url: "https://example.test", label: "Source" }],
        holidayKey: "holiday",
        evidence: [{ at: "2026-10-14", kind: "saved", by: "Editor", text: "Saved draft" }],
        published: { facebook: { at: "2026-10-14", by: "Editor", url: "https://example.test/post", how: "manual" } },
        workItemId: "approval",
        draftedAt: new Date("2026-10-12T00:00:00.000Z"),
        approvedBy: "Approver",
        approvedAt: new Date("2026-10-13T00:00:00.000Z"),
        publishedAt: null,
        source: "plan",
        createdBy: "Author",
        createdAt: new Date("2026-10-11T00:00:00.000Z"),
        updatedAt: new Date("2026-10-14T00:00:00.000Z"),
    })

describe("content editor row mapping", () => {
    it("serializes Date timestamps and preserves driver strings", async () => {
        const subject = await build()

        expect(subject.contentInstant(new Date("2026-10-14T01:02:03.456Z"))).toBe("2026-10-14T01:02:03.456Z")
        expect(subject.contentInstant("driver timestamp")).toBe("driver timestamp")
    })

    it("preserves every editor, publication, audit and approval field", async () => {
        const subject = await build()

        expect(subject.toContentItem(storedRow())).toEqual({
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

    it("defaults unsupported channels, lifecycle state and source", async () => {
        const subject = await build()

        const row = { ...storedRow(), channels: ["unknown"], status: "unknown", source: "unknown" }
        expect(subject.toContentItem(row)).toEqual({
            ...subject.toContentItem(storedRow()),
            channels: ["facebook"],
            status: "idea",
            source: "manual",
        })
    })
})
