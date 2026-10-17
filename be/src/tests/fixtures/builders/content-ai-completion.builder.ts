import { builder } from "@starci/jest-preset"
import type { GenerationState } from "@modules/domain/ai-generations"
import type { ContentItem } from "@modules/domain/content-items"

export const NOW = "2026-10-13T03:00:30.000Z"

export const stateOf = builder<GenerationState>({
    id: "g-2",
    workspaceId: "ws-1",
    purpose: "content_plan",
    status: "done",
    text: null,
    errorCode: null,
    input: { context: { rootId: "g-1" } },
    output: {},
    timings: {},
    createdAt: "2026-10-13T03:00:00.000Z",
    finishedAt: null,
    messages: [{ role: "user", content: "Write a post" }],
})

const BRAND = {
    shop: "Flower Shop",
    knowledge: "Fresh flowers delivered the same day.",
    voice: "friendly",
    avoid: "",
    audience: "Office customers",
    cta: "Message the shop",
    sources: [],
    brandHashtags: ["#tiemhoa"],
}

export const PILLAR = { id: "pl-1", name: "Products", description: "", weight: 1, active: true }

export const itemOf = builder<ContentItem>({
    id: "item-1",
    workspaceId: "ws-1",
    planId: null,
    title: "Roses this week",
    brief: "",
    pillarId: "pl-1",
    channels: ["zalo"],
    scheduledAt: null,
    status: "idea",
    variants: {},
    hashtags: [],
    media: [{ kind: "image", name: "old.jpg", suggested: true }],
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
    createdBy: "Lan",
    createdAt: "2026-10-12T00:00:00.000Z",
    updatedAt: "2026-10-12T00:00:00.000Z",
})

export const PLAN_CONTEXT = {
    operation: "plan",
    generationIds: ["g-2"],
    month: "2026-11",
    actor: "Lan",
    quota: [],
    holidays: [],
    sources: ["Price list"],
    skippedPast: 2,
    slots: [
        { n: 1, at: "2026-11-02T02:00:00.000Z", channels: ["facebook"], pillar: PILLAR, holiday: null },
        { n: 2, at: "2026-11-05T02:00:00.000Z", channels: ["zalo"], pillar: PILLAR, holiday: null },
    ],
}

export const planRoot = stateOf({ id: "g-1", status: "running", input: { context: PLAN_CONTEXT } })

export const DRAFT_CONTEXT = {
    operation: "draft",
    generationIds: ["g-2"],
    itemId: "item-1",
    channels: ["facebook", "myspace"],
    brand: BRAND,
    library: [{ kind: "image", name: "hoa-hong.jpg", path: "ws-1/hoa-hong.jpg" }],
    pillars: [],
    expectedUpdatedAt: "2026-10-12T00:00:00.000Z",
}

export const draftRoot = stateOf({
    id: "g-1",
    purpose: "content_draft",
    status: "running",
    input: { context: DRAFT_CONTEXT },
})

export const draftChild = stateOf({
    purpose: "content_draft",
    text: JSON.stringify({
        variants: { facebook: { text: "Fresh roses every morning.", hashtags: ["#hoahong"], note: "" } },
        media: [1, 7],
        hashtags: ["hoa hong"],
    }),
})
