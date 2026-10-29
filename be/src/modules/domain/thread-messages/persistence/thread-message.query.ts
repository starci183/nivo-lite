import type { EntityManager, SelectQueryBuilder } from "typeorm"
import type { ThreadMessageRead } from "../thread-messages.contracts"
import { ThreadMessageEntity } from "./entities"

/**
 * A read of the messages of one workspace, before the name of the author is added (see ThreadMessageAuthorsService). The caller adds
 * its own filter, order and bound.
 */
export const selectMessages = (manager: EntityManager, workspaceId: string): SelectQueryBuilder<ThreadMessageEntity> =>
    manager
        .createQueryBuilder(ThreadMessageEntity, "m")
        .select([
            "m.id AS id",
            "m.thread_id AS thread_id",
            "m.workspace_id AS workspace_id",
            "m.author_kind AS author_kind",
            "m.author_id AS author_id",
            "m.body AS body",
            "m.quoted AS quoted",
            "m.mentions AS mentions",
            "m.approval AS approval",
            "m.created_at AS created_at",
        ])
        .where("m.workspace_id = :workspaceId", { workspaceId })

/** One message of the workspace without its author's name, or undefined when there is none with that id. */
export const readMessageById = (
    manager: EntityManager,
    workspaceId: string,
    messageId: string,
): Promise<ThreadMessageRead | undefined> =>
    selectMessages(manager, workspaceId)
        .andWhere("m.id = :messageId", { messageId })
        .limit(1)
        .getRawOne<ThreadMessageRead>()
