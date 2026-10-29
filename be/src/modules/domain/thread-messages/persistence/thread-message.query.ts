import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { ThreadMessageRecord } from "../thread-messages.contracts"
import { ThreadMessageEntity } from "./entities"

/**
 * A read of the messages of one workspace joined with the name of their author: an agent's name and module, or a member's display name
 * and role. The caller adds its own filter, order and bound.
 */
export const selectMessagesWithAuthor = (
    manager: EntityManager,
    workspaceId: string,
): SelectQueryBuilder<ThreadMessageEntity> =>
    manager
        .createQueryBuilder(ThreadMessageEntity, "m")
        .leftJoin("agents", "a", "m.author_kind = 'agent' AND a.id = m.author_id")
        .leftJoin(
            "workspace_members",
            "w",
            "m.author_kind = 'member' AND w.id = m.author_id AND w.workspace_id = m.workspace_id",
        )
        .select([
            "m.id AS id",
            "m.thread_id AS thread_id",
            "m.workspace_id AS workspace_id",
            "m.author_kind AS author_kind",
            "m.author_id AS author_id",
            "coalesce(a.name, w.display_name, '') AS author_name",
            "coalesce(a.module, w.role, '') AS author_role",
            "m.body AS body",
            "m.quoted AS quoted",
            "m.mentions AS mentions",
            "m.approval AS approval",
            "m.created_at AS created_at",
        ])
        .where("m.workspace_id = :workspaceId", { workspaceId })

/** One message of the workspace with its author's name, or undefined when there is none with that id. */
export const readMessageById = (
    manager: EntityManager,
    workspaceId: string,
    messageId: string,
): Promise<ThreadMessageRecord | undefined> =>
    selectMessagesWithAuthor(manager, workspaceId)
        .andWhere("m.id = :messageId", { messageId })
        .limit(1)
        .getRawOne<ThreadMessageRecord>()
