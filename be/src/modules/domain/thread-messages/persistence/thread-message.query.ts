import type { ObjectLiteral, SelectQueryBuilder } from "typeorm"

/**
 * The columns of a read of the messages of one workspace, before the name of the author is added (see ThreadMessageAuthorsService).
 * The builder is over the messages table under the alias `m`; the caller adds its own filter, order and bound.
 */
export const selectMessageColumns = <Row extends ObjectLiteral>(
    builder: SelectQueryBuilder<Row>,
    workspaceId: string,
): SelectQueryBuilder<Row> =>
    builder
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
