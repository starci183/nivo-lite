import {
    readContentVariants,
    readContentMedia,
    readContentLinks,
    readContentEvidence,
    readContentPublished,
} from "./content-editor-json.mapper"
import { CONTENT_CHANNELS } from "./content-editor.contracts"

const CONTENT_STATUSES = new Set(["idea", "draft", "waiting_approval", "approved", "published", "skipped"])
const CONTENT_SOURCES = new Set(["manual", "plan", "quick", "offer", "automation"])
const readChannels = (values: ReadonlyArray<string>): Array<string> => {
    const channels = values.filter((channel) => CONTENT_CHANNELS.includes(channel))
    return channels.length === 0 ? ["facebook"] : channels
}
import type { ContentItem } from "./content-editor.contracts"
import type { ContentEditorRow } from "./persistence/content-editor.rows"

/** Serializes a PostgreSQL timestamp independently of the driver parser. */
export const contentInstant = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

const optionalInstant = (value: Date | string | null): string | null => (value === null ? null : contentInstant(value))

/** Maps a stored item without losing any editor, audit or approval field. */
export const toContentItem = (row: ContentEditorRow): ContentItem => ({
    id: row.id,
    workspaceId: row.workspace_id,
    planId: row.plan_id,
    title: row.title,
    brief: row.brief,
    pillarId: row.pillar_id,
    channels: readChannels(row.channels),
    scheduledAt: optionalInstant(row.scheduled_at),
    status: CONTENT_STATUSES.has(row.status) ? row.status : "idea",
    variants: readContentVariants(row.variants),
    hashtags: row.hashtags,
    media: readContentMedia(row.media),
    links: readContentLinks(row.links),
    holidayKey: row.holiday_key,
    evidence: readContentEvidence(row.evidence),
    published: readContentPublished(row.published),
    workItemId: row.work_item_id,
    draftedAt: optionalInstant(row.drafted_at),
    approvedBy: row.approved_by,
    approvedAt: optionalInstant(row.approved_at),
    publishedAt: optionalInstant(row.published_at),
    source: CONTENT_SOURCES.has(row.source) ? row.source : "manual",
    createdBy: row.created_by,
    createdAt: contentInstant(row.created_at),
    updatedAt: contentInstant(row.updated_at),
})
