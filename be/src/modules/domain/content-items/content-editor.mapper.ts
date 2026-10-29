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
import type { ContentItemEntity } from "./persistence/entities"

/** Serializes a PostgreSQL timestamp independently of the driver parser. */
export const contentInstant = (value: Date | string): string => (value instanceof Date ? value.toISOString() : value)

const optionalInstant = (value: Date | string | null): string | null => (value === null ? null : contentInstant(value))

/** Maps a stored item without losing any editor, audit or approval field. */
export const toContentItem = (row: ContentItemEntity): ContentItem => ({
    id: row.id,
    workspaceId: row.workspaceId,
    planId: row.planId,
    title: row.title,
    brief: row.brief,
    pillarId: row.pillarId,
    channels: readChannels(row.channels),
    scheduledAt: optionalInstant(row.scheduledAt),
    status: CONTENT_STATUSES.has(row.status) ? row.status : "idea",
    variants: readContentVariants(row.variants),
    hashtags: row.hashtags,
    media: readContentMedia(row.media),
    links: readContentLinks(row.links),
    holidayKey: row.holidayKey,
    evidence: readContentEvidence(row.evidence),
    published: readContentPublished(row.published),
    workItemId: row.workItemId,
    draftedAt: optionalInstant(row.draftedAt),
    approvedBy: row.approvedBy,
    approvedAt: optionalInstant(row.approvedAt),
    publishedAt: optionalInstant(row.publishedAt),
    source: CONTENT_SOURCES.has(row.source) ? row.source : "manual",
    createdBy: row.createdBy,
    createdAt: contentInstant(row.createdAt),
    updatedAt: contentInstant(row.updatedAt),
})
