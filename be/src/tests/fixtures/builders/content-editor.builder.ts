import { contentItemsEntities } from "@modules/domain/content-items"

const ContentItemEntity: (typeof contentItemsEntities)[0] = contentItemsEntities[0]
type ContentItemEntity = InstanceType<typeof ContentItemEntity>

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

type ReadingStatusResultShape = {
    findOne: readonly [typeof ContentItemEntity, ContentItemEntity]
}

/** The stubs of a manager whose read of one item answers an item of the status (and, optionally, its draft time and media). */
export const readingStatus = (
    status: string,
    draftedAt: Date | null = null,
    media: ContentItemEntity["media"] = [],
): ReadingStatusResultShape => ({ findOne: [ContentItemEntity, row({ status, draftedAt, media })] as const })

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

type ItemPublishedShape = {}

type ItemShape = {
    workspaceId: string
    planId: null
    pillarId: null
    scheduledAt: null
    holidayKey: null
    workItemId: null
    draftedAt: null
    approvedBy: null
    approvedAt: null
    publishedAt: null
    createdBy: string
    createdAt: string
    updatedAt: string
    id: string
    title: string
    brief: string
    channels: Array<string>
    status: string
    variants: ItemPublishedShape
    hashtags: Array<never>
    media: Array<never>
    links: Array<never>
    evidence: Array<never>
    published: ItemPublishedShape
    source: string
}

/** The API projection of the persisted content item. */
export const item: ItemShape = {
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

type EditedEvidenceShape = {
    at: string
    kind: string
    by: string
    text: string
}

/** The expected audit trail of an edit. */
export const editedEvidence: Array<EditedEvidenceShape> = [{ at, kind: "edited", by: "Mai", text: "edited" }]

/** The expected audit trail of a creation. */
export const createdEvidence: Array<EditedEvidenceShape> = [{ at, kind: "created", by: "Mai", text: "created" }]

type LegacyAttachmentsShape2 = {
    kind: string
    name: string
    path: string
}

type LegacyAttachmentsShape = {
    kind: string
    name: string
    path?: never
}

/** Legacy attachments retained when a post is moved. */
export const legacyAttachments: Array<LegacyAttachmentsShape | LegacyAttachmentsShape2> = [
    { kind: "video_render", name: "Legacy" },
    { kind: "media", name: "Photo", path: "workspace-1/photo.jpg" },
]

type CompletedRenderAttachmentsShape = {
    kind: string
    name: string
    id: string
}

/** Two attachment references to the same completed render. */
export const completedRenderAttachments: Array<CompletedRenderAttachmentsShape> = [
    { kind: "video_render", name: "Video", id: "00000000-0000-0000-0000-000000000001" },
    { kind: "video_render", name: "Duplicate", id: "00000000-0000-0000-0000-000000000001" },
]

type SelectedPillarInputShape = {
    title: string
    channels: Array<string>
    pillarId: string
    scheduledAt: string
}

/** Editor input with an explicitly selected pillar and schedule. */
export const selectedPillarInput: SelectedPillarInputShape = {
    title: "x".repeat(210),
    channels: ["zalo"],
    pillarId: "pillar-1",
    scheduledAt: "2026-02-01",
}

type WorkbenchExpectedResultLastPlanShape = {
    month: string
    ideas: number
    ms: number
    createdAt: string
}

type WorkbenchExpectedResultFiguresPillarsShape = {
    covered: number
    total: number
}

type WorkbenchExpectedResultFiguresShape = {
    awaitingApproval: number
    published30: number
    next: null
    pillars: WorkbenchExpectedResultFiguresPillarsShape
}

type WorkbenchExpectedResultActorShape = {
    workspaceId: string
    name: string
    canManage: boolean
}

type WorkbenchExpectedResultShape = {
    nowIso: string
    workspaceId: string
    canManage: boolean
    actor: WorkbenchExpectedResultActorShape
    items: Array<never>
    figures: WorkbenchExpectedResultFiguresShape
    lastPlan: WorkbenchExpectedResultLastPlanShape | null
}

/** The expected authorized workbench, optionally with the last generated plan. */
export const workbenchExpected = (hasPlan = false): WorkbenchExpectedResultShape => ({
    nowIso: at,
    workspaceId: "workspace-1",
    canManage: true,
    actor: { workspaceId: "workspace-1", name: "Mai", canManage: true },
    items: [],
    figures: { awaitingApproval: 0, published30: 0, next: null, pillars: { covered: 0, total: 0 } },
    lastPlan: hasPlan ? { month: "2025-12", ideas: 8, ms: 45, createdAt: at } : null,
})
