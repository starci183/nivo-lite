import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CommentNote, CommentReplyState, PageComment } from "./meta-comments.contracts"
import { MetaCommentEntity } from "./persistence/entities"

const msOf = (value: Date | string | null): number | null => {
    if (value === null) return null
    const ms = value instanceof Date ? value.getTime() : Date.parse(value)
    return Number.isNaN(ms) ? null : ms
}

@Injectable()
/** Owns the received comments: the one writer of meta_comments. */
export class MetaCommentsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Remembers a comment once, inside the caller's transaction when one is handed in. */
    async note(comment: CommentNote, manager: EntityManager = this.entityManager): Promise<void> {
        await manager
            .createQueryBuilder(MetaCommentEntity, "mc")
            .insert()
            .values({
                connectionId: comment.connectionId,
                commentId: comment.commentId,
                platform: comment.platform,
                commentAt: new Date(comment.at),
            })
            .orIgnore()
            .execute()
    }

    /** Where the private reply of a comment stands. */
    async replyState(comment: PageComment): Promise<CommentReplyState> {
        const row = await this.entityManager.findOne(MetaCommentEntity, {
            select: { commentAt: true, privateRepliedAt: true },
            where: { connectionId: comment.connectionId, commentId: comment.commentId },
        })
        return {
            commentAt: msOf(row?.commentAt ?? null),
            replied: msOf(row?.privateRepliedAt ?? null) !== null,
        }
    }

    /** Claims the one private reply of a comment before it is sent; false when somebody already took it. */
    async claim(comment: PageComment): Promise<boolean> {
        const result = await this.entityManager.update(
            MetaCommentEntity,
            { connectionId: comment.connectionId, commentId: comment.commentId, privateRepliedAt: IsNull() },
            { privateRepliedAt: () => "now()" },
        )
        return (result.affected ?? 0) > 0
    }

    /** Gives the one private reply back after a send that failed for another reason than "already answered". */
    async release(comment: PageComment): Promise<void> {
        await this.entityManager.update(
            MetaCommentEntity,
            { connectionId: comment.connectionId, commentId: comment.commentId },
            { privateRepliedAt: null },
        )
    }
}
