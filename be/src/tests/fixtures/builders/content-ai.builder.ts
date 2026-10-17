import { builder } from "@starci/jest-preset"
import type { GenerationState } from "@modules/domain/ai-generations"
import type { ContentItem } from "@modules/domain/content-items"
import type { ContentConfiguration } from "@modules/domain/content-settings"
import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { BrandMaterial, ContentAiStatus } from "@modules/domain/content-ai"

export const MEMBER: WorkspaceMember = {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "owner",
    staffId: null,
    displayName: "An",
    status: "active",
}

export const MATERIAL: BrandMaterial = {
    shop: "Lan",
    authority: { brandVoice: "warm", replyStyle: "short", limitsNote: "" },
    setup: { summary: "Cafe", facts: [], tone: "", claimsLimits: "", audience: "", channels: "" },
    sources: [],
    brainFacts: [],
}

/** The active content theme for monthly planning. */
export const PILLAR = {
    id: "pillar-1",
    workspaceId: "ws-1",
    name: "Coffee",
    description: "Beans",
    weight: 1,
    active: true,
    sort: 0,
}

/** A daily Facebook schedule with all weekdays available. */
export const CADENCE = {
    id: "cadence-1",
    workspaceId: "ws-1",
    channel: "facebook" as const,
    postsPerWeek: 7,
    days: [1, 2, 3, 4, 5, 6, 7],
    time: "09:00",
}

export const CONFIGURATION: ContentConfiguration = {
    pillars: [PILLAR],
    cadence: [CADENCE],
    settings: {
        workspaceId: "ws-1",
        brandVoice: "",
        avoid: "",
        cta: "Book",
        hashtags: [],
        automations: { today_reminder: false, offer_draft: false, weekly_summary: false },
        marks: {},
    },
}

/** Builds an editable content idea with per-case overrides. */
export const itemOf = builder<ContentItem>({
    id: "item-1",
    workspaceId: "ws-1",
    planId: null,
    title: "Coffee",
    brief: "Fresh beans",
    pillarId: null,
    channels: ["facebook"],
    scheduledAt: null,
    status: "idea",
    variants: {},
    hashtags: [],
    media: [],
    links: [],
    holidayKey: null,
    evidence: [],
    published: {},
    workItemId: null,
    draftedAt: null,
    approvedBy: null,
    approvedAt: null,
    publishedAt: null,
    source: "plan",
    createdBy: "An",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
})

/** Builds a queued generation and its related child identities. */
export const stateOf = builder<GenerationState>({
    id: "g-1",
    workspaceId: "ws-1",
    purpose: "content_draft",
    status: "queued",
    text: null,
    errorCode: null,
    input: { context: { rootId: "g-1", generationIds: ["g-2", "g-3"], itemId: "item-1" } },
    output: {},
    timings: {},
    createdAt: "2026-10-12T00:00:00.000Z",
    finishedAt: null,
    messages: [],
})

/** Builds the expected public status of a queued content operation. */
export const statusOf = builder<ContentAiStatus>({
    id: "g-1",
    status: "queued",
    progress: 0,
    itemId: "item-1",
    planId: null,
    resultId: null,
    ideas: null,
    seconds: null,
    skippedPast: null,
    warnings: [],
    errorCode: null,
})
