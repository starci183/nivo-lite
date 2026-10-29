import type { ContentCadence } from "./content-cadence.contracts"
import type { ContentCadenceEntity } from "./persistence/entities"

/** Maps a stored posting rhythm. */
export const toContentCadence = (row: ContentCadenceEntity): ContentCadence => ({
    id: row.id,
    workspaceId: row.workspaceId,
    channel: row.channel,
    postsPerWeek: row.postsPerWeek,
    days: row.days,
    time: row.postTime,
})
