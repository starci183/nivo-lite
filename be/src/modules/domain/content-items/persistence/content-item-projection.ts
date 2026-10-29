import type { AgentDraftRef, DueItem } from "../content-items.contracts"
import { ContentItemEntity } from "./entities"

/** A timestamp column as the ISO text the contracts carry (UTC, millisecond precision). */
export const ISO_TEXT = (column: string): string =>
    `to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`

/** A post due in a window, as the projection query answers it. */
export type DueItemProjection = DueItem

/** A stored post as the scheduler reads it. */
export interface ScheduleProjection {
    /** The post. */
    readonly id: string
    /** Its title. */
    readonly title: string
    /** The channels it goes to. */
    readonly channels: ReadonlyArray<string>
    /** The text of each channel. */
    readonly variants: Readonly<Record<string, { readonly text?: string }>>
    /** The attached media. */
    readonly media: ReadonlyArray<{ readonly path?: string }>
    /** When it should be published, in the database's own text; null when unscheduled. */
    readonly scheduledAt: string | null
}

/** A post due on one channel, with its workspace and the reference that channel gave. */
export interface DueChannelProjection extends ScheduleProjection {
    /** The workspace. */
    readonly workspaceId: string
    /** The channel's reference. */
    readonly ref: string
}

/** The rows an `INSERT/UPDATE ... RETURNING` answered, each as a plain record. */
export const returnedRows = (raw: unknown): ReadonlyArray<object> =>
    Array.isArray(raw) ? raw.filter((row): row is object => typeof row === "object" && row !== null) : []

/** The snapshot of a stored draft out of a returned row; undefined when the row lacks one of its parts. */
export const draftRefOf = (row: object): AgentDraftRef | undefined => {
    const id: unknown = Reflect.get(row, "id")
    const variants: unknown = Reflect.get(row, "variants")
    const channels: unknown = Reflect.get(row, "channels")
    if (typeof id !== "string" || typeof variants !== "object" || variants === null || !Array.isArray(channels))
        return undefined
    return { id, variants: Object.fromEntries(Object.entries(variants)), channels: channels.map(String) }
}

/** The entity property and the column it reads, for every column a `RETURNING *` row carries. */
const COLUMNS: ReadonlyArray<readonly [string, string]> = [
    ["id", "id"],
    ["workspaceId", "workspace_id"],
    ["planId", "plan_id"],
    ["title", "title"],
    ["brief", "brief"],
    ["pillarId", "pillar_id"],
    ["channels", "channels"],
    ["scheduledAt", "scheduled_at"],
    ["status", "status"],
    ["variants", "variants"],
    ["hashtags", "hashtags"],
    ["media", "media"],
    ["links", "links"],
    ["holidayKey", "holiday_key"],
    ["evidence", "evidence"],
    ["published", "published"],
    ["workItemId", "work_item_id"],
    ["draftedAt", "drafted_at"],
    ["approvedBy", "approved_by"],
    ["approvedAt", "approved_at"],
    ["publishedAt", "published_at"],
    ["source", "source"],
    ["createdBy", "created_by"],
    ["createdAt", "created_at"],
    ["updatedAt", "updated_at"],
]

/** The first post a `RETURNING *` write answered, read as an entity; undefined when the write answered nothing. */
export const contentItemOfRaw = (raw: unknown): ContentItemEntity | undefined => {
    const [row] = returnedRows(raw)
    return row === undefined
        ? undefined
        : Object.assign(
              new ContentItemEntity(),
              Object.fromEntries(COLUMNS.map(([property, column]) => [property, Reflect.get(row, column)])),
          )
}
