import type { EntityManager, SelectQueryBuilder } from "typeorm"
import { WorkThreadEntity } from "./entities"

/**
 * The columns a thread read selects, as the contract carries them: the instants as `to_json` text, which keeps the microseconds the
 * page cursor seeks by.
 */
export const THREAD_COLUMNS = [
    "t.id AS id",
    "t.workspace_id AS workspace_id",
    "t.title AS title",
    "t.lead_id AS lead_id",
    "t.order_id AS order_id",
    "t.status AS status",
    "t.created_by AS created_by",
    "to_json(t.created_at) #>> '{}' AS created_at",
    "to_json(t.updated_at) #>> '{}' AS updated_at",
] as const

/** The same columns for an `INSERT ... RETURNING`, where the table has no alias. */
export const THREAD_RETURNING =
    "id, workspace_id, title, lead_id, order_id, status, created_by, to_json(created_at) #>> '{}' AS created_at, to_json(updated_at) #>> '{}' AS updated_at"

/** A read of the threads of one workspace; the caller adds its own filter, order, bound and lock. */
export const selectThreads = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<WorkThreadEntity> =>
    manager
        .createQueryBuilder(WorkThreadEntity, "t")
        .select([...THREAD_COLUMNS])
        .where("t.workspace_id = :workspaceId", { workspaceId })
