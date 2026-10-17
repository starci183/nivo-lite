import type { ContentEditorRow } from "../../../modules/domain/content-items/persistence/content-editor.rows"

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
export const row = (patch: Partial<ContentEditorRow> = {}): ContentEditorRow => ({
    ...shared,
    workspace_id: "workspace-1",
    plan_id: null,
    pillar_id: null,
    scheduled_at: null,
    holiday_key: null,
    work_item_id: null,
    drafted_at: null,
    approved_by: null,
    approved_at: null,
    published_at: null,
    created_by: "Mai",
    created_at: new Date(at),
    updated_at: at,
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

/** The expected audit entry for an edit. */
const edited = JSON.stringify([{ at, kind: "edited", by: "Mai", text: "edited" }])

interface ContentSaveBindings {
    readonly schedule: string | null
    readonly variants: string
    readonly media: string
    readonly status: string
    readonly draftedAt: string | null
}

/** Expected SQL bindings for the standard content row with explicit scenario changes. */
export const saveBindings = (patch: Partial<ContentSaveBindings> = {}): Array<unknown> => {
    const values: ContentSaveBindings = {
        schedule: null,
        variants: "{}",
        media: "[]",
        status: "idea",
        draftedAt: null,
        ...patch,
    }
    return [
        "workspace-1",
        "item-1",
        "Launch",
        "Explain launch",
        null,
        ["facebook"],
        values.schedule,
        values.variants,
        [],
        "[]",
        values.media,
        values.status,
        values.draftedAt,
        edited,
    ]
}

/** Expected bindings for creating the explicitly selected pillar and schedule. */
export const createdPillarBindings = [
    "workspace-1",
    "x".repeat(200),
    ["zalo"],
    "2026-02-01",
    "pillar-1",
    "Mai",
    JSON.stringify([{ at, kind: "created", by: "Mai", text: "created" }]),
]

/** Expected workspace and Vietnam month boundaries at the fixed clock instant. */
export const monthBindings = ["workspace-1", at, "2025-12-31T17:00:00.000Z", "2026-01-31T17:00:00.000Z"]

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
