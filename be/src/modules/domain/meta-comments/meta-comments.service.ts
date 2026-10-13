import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CommentNote, CommentReplyState, PageComment } from "./meta-comments.contracts"
import type { ClaimedCommentRow, MetaCommentRow } from "./persistence/meta-comments.rows"
import {
    CLAIM_PRIVATE_REPLY,
    FIND_META_COMMENT,
    NOTE_META_COMMENT,
    RELEASE_PRIVATE_REPLY,
} from "./persistence/meta-comments.sql"

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
        await manager.query(NOTE_META_COMMENT, [comment.connectionId, comment.commentId, comment.platform, comment.at])
    }

    /** Where the private reply of a comment stands. */
    async replyState(comment: PageComment): Promise<CommentReplyState> {
        const [row] = await this.entityManager.query<Array<MetaCommentRow>>(FIND_META_COMMENT, [
            comment.connectionId,
            comment.commentId,
        ])
        return {
            commentAt: msOf(row?.comment_at ?? null),
            replied: msOf(row?.private_replied_at ?? null) !== null,
        }
    }

    /** Claims the one private reply of a comment before it is sent; false when somebody already took it. */
    async claim(comment: PageComment): Promise<boolean> {
        const rows = await this.entityManager.query<Array<ClaimedCommentRow>>(CLAIM_PRIVATE_REPLY, [
            comment.connectionId,
            comment.commentId,
        ])
        return rows.length > 0
    }

    /** Gives the one private reply back after a send that failed for another reason than "already answered". */
    async release(comment: PageComment): Promise<void> {
        await this.entityManager.query(RELEASE_PRIVATE_REPLY, [comment.connectionId, comment.commentId])
    }
}
