import { ContentAutomationMarksMapper } from "@modules/domain/content-settings"
import type { ContentBrandSettings, ContentCadence, ContentPillar } from "@modules/domain/content-settings"
import type { ContentBrandSettingsType } from "./dto/content-brand-settings.type"
import type { ContentCadenceType } from "./dto/content-cadence.type"
import type { ContentPillarType } from "./dto/content-pillar.type"

/** Maps a theme to its GraphQL fields. */
export const toContentPillarType = (pillar: ContentPillar): ContentPillarType => ({
    id: pillar.id,
    workspaceId: pillar.workspaceId,
    name: pillar.name,
    description: pillar.description,
    weight: pillar.weight,
    active: pillar.active,
    sort: pillar.sort,
})

/** Maps a posting rhythm to its GraphQL fields. */
export const toContentCadenceType = (cadence: ContentCadence): ContentCadenceType => ({
    id: cadence.id,
    workspaceId: cadence.workspaceId,
    channel: cadence.channel,
    postsPerWeek: cadence.postsPerWeek,
    days: [...cadence.days],
    time: cadence.time,
})

/** Maps settings, exposing the automation flags as explicit fields. */
export const toContentBrandSettingsType = (settings: ContentBrandSettings): ContentBrandSettingsType => ({
    workspaceId: settings.workspaceId,
    brandVoice: settings.brandVoice,
    avoid: settings.avoid,
    cta: settings.cta,
    hashtags: [...settings.hashtags],
    automations: {
        todayReminder: settings.automations.today_reminder,
        offerDraft: settings.automations.offer_draft,
        weeklySummary: settings.automations.weekly_summary,
    },
    marks: new ContentAutomationMarksMapper(settings).marks,
})
