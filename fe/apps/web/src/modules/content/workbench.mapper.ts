import type { ContentConfigurationType, ContentItemType, ContentMediaType, ContentWorkbenchType } from "@/modules/api"
import { isContentChannel, isContentStatus } from "./types"
import type { ContentItem, ContentSource, ContentWorkbenchData, MediaRef } from "./types"

const sourceOf = (source: string): ContentSource => {
    if (source === "plan" || source === "quick" || source === "offer" || source === "automation") return source
    return "manual"
}

/** Adapts generated GraphQL post fields to the existing editor's presentation model. */
export const contentItemView = (item: ContentItemType): ContentItem => ({
    id: item.id,
    workspace_id: item.workspaceId,
    plan_id: item.planId ?? null,
    title: item.title,
    brief: item.brief,
    pillar_id: item.pillarId ?? null,
    channels: item.channels.filter(isContentChannel),
    scheduled_at: item.scheduledAt ?? null,
    status: isContentStatus(item.status) ? item.status : "idea",
    variants: Object.fromEntries(
        item.variants
            .filter((v) => isContentChannel(v.channel))
            .map((v) => [v.channel, { text: v.text, hashtags: v.hashtags, note: v.note }]),
    ),
    hashtags: item.hashtags,
    media: item.media.map((media) => ({
        kind: media.kind === "video_render" ? "video_render" : "media",
        name: media.name,
        id: media.id ?? undefined,
        path: media.path ?? undefined,
        suggested: media.suggested,
    })),
    links: item.links,
    holiday_key: item.holidayKey ?? null,
    evidence: item.evidence,
    published: Object.fromEntries(
        item.published
            .filter((mark) => isContentChannel(mark.channel))
            .map((mark) => [mark.channel, { at: mark.at, by: mark.by, url: mark.url, how: mark.how }]),
    ),
    work_item_id: item.workItemId ?? null,
    drafted_at: item.draftedAt ?? null,
    approved_by: item.approvedBy ?? null,
    approved_at: item.approvedAt ?? null,
    published_at: item.publishedAt ?? null,
    source: sourceOf(item.source),
    created_by: item.createdBy,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
})

/** Combines independently cached workbench, configuration and signed media responses. */
export const contentWorkbenchView = (
    core: ContentWorkbenchType,
    configuration: ContentConfigurationType,
    media: ContentMediaType | undefined,
): ContentWorkbenchData => ({
    nowIso: core.nowIso,
    workspaceId: core.workspaceId,
    canManage: core.canManage,
    items: core.items.map(contentItemView),
    pillars: configuration.pillars.map((pillar) => ({ ...pillar, workspace_id: pillar.workspaceId })),
    cadence: configuration.cadence
        .filter((row) => isContentChannel(row.channel))
        .map((row) => ({
            id: row.id,
            workspace_id: row.workspaceId,
            channel: isContentChannel(row.channel) ? row.channel : "facebook",
            posts_per_week: row.postsPerWeek,
            days: row.days,
            post_time: row.time,
        })),
    settings: {
        workspace_id: configuration.settings.workspaceId,
        brand_voice: configuration.settings.brandVoice,
        avoid: configuration.settings.avoid,
        cta: configuration.settings.cta,
        hashtags: configuration.settings.hashtags,
        automations: {
            today_reminder: configuration.settings.automations.todayReminder,
            offer_draft: configuration.settings.automations.offerDraft,
            weekly_summary: configuration.settings.automations.weeklySummary,
        },
        marks: Object.fromEntries(configuration.settings.marks.map((mark) => [mark.key, mark.value])),
    },
    library: (media?.library ?? []).map((entry): MediaRef => ({ kind: "media", name: entry.name, path: entry.path })),
    videos: (media?.videos ?? []).map((video) => ({ ...video, durationMs: video.durationMs ?? null })),
    urls: Object.fromEntries((media?.urls ?? []).map((url) => [url.key, { view: url.view, download: url.download }])),
    lastPlan: core.lastPlan ? { ...core.lastPlan, ms: core.lastPlan.ms ?? null } : null,
    figures: { ...core.figures, next: core.figures.next ?? null },
})
