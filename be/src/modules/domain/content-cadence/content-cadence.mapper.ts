import type { ContentCadence } from "./content-cadence.contracts"
import type { ContentCadenceRow } from "./persistence/content-cadence.rows"

/** Maps a stored posting rhythm. */
export const toContentCadence = (row: ContentCadenceRow): ContentCadence => ({
    id: row.id,
    workspaceId: row.workspace_id,
    channel: row.channel,
    postsPerWeek: row.posts_per_week,
    days: row.days,
    time: row.post_time,
})
