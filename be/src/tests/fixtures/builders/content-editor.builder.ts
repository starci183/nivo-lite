import { ContentItemEntity } from "@modules/domain/content-items"

/** The fixed instant used by content editing scenarios. */
export const at = "2026-01-01T00:00:00.000Z"

/** A managing member of the content workspace. */
export const member = {
    userId: "user-1",
    workspaceId: "workspace-1",
    role: "owner" as const,
    staffId: null,
    displayName: "Mai",
    status: "active" as const,
}

const shared = {
    id: "item-1",
    title: "Launch",
    brief: "Explain launch",
    channels: ["facebook"],
    status: "idea",
    variants: {},
    hashtags: [],
    media: [],
    links: [],
    evidence: [],
    published: {},
    source: "manual",
}

/** A persisted content item with optional field overrides. */
export const row = (patch: Partial<ContentItemEntity> = {}): ContentItemEntity =>
    Object.assign(new ContentItemEntity(), {
        ...shared,
        workspaceId: "workspace-1",
        planId: null,
        pillarId: null,
        scheduledAt: null,
        holidayKey: null,
        workItemId: null,
        draftedAt: null,
        approvedBy: null,
        approvedAt: null,
        publishedAt: null,
        createdBy: "Mai",
        createdAt: new Date(at),
        updatedAt: new Date(at),
        ...patch,
    })

/** The API projection of the persisted content item. */
export const item = {
    ...shared,
    workspaceId: "workspace-1",
    planId: null,
    pillarId: null,
    scheduledAt: null,
    holidayKey: null,
    workItemId: null,
    draftedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    createdBy: "Mai",
    createdAt: at,
    updatedAt: at,
}

/** The expected audit trail of an edit. */
export const editedEvidence = [{ at, kind: "edited", by: "Mai", text: "edited" }]

/** The expected audit trail of a creation. */
export const createdEvidence = [{ at, kind: "created", by: "Mai", text: "created" }]

/** Legacy attachments retained when a post is moved. */
export const legacyAttachments = [
    { kind: "video_render", name: "Legacy" },
    { kind: "media", name: "Photo", path: "workspace-1/photo.jpg" },
]

/** Two attachment references to the same completed render. */
export const completedRenderAttachments = [
    { kind: "video_render", name: "Video", id: "00000000-0000-0000-0000-000000000001" },
    { kind: "video_render", name: "Duplicate", id: "00000000-0000-0000-0000-000000000001" },
]

/** Editor input with an explicitly selected pillar and schedule. */
export const selectedPillarInput = {
    title: "x".repeat(210),
    channels: ["zalo"],
    pillarId: "pillar-1",
    scheduledAt: "2026-02-01",
}

/** The expected authorized workbench, optionally with the last generated plan. */
export const workbenchExpected = (hasPlan = false) => ({
    nowIso: at,
    workspaceId: "workspace-1",
    canManage: true,
    actor: { workspaceId: "workspace-1", name: "Mai", canManage: true },
    items: [],
    figures: { awaitingApproval: 0, published30: 0, next: null, pillars: { covered: 0, total: 0 } },
    lastPlan: hasPlan ? { month: "2025-12", ideas: 8, ms: 45, createdAt: at } : null,
})
