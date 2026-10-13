import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { CommentNote } from "./meta-comments.contracts"
import { NOTE_META_COMMENT } from "./persistence/meta-comments.sql"

@Injectable()
/** Owns the received comments: the one writer of meta_comments. */
export class MetaCommentsService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Remembers a comment once, inside the caller's transaction when one is handed in. */
    async note(comment: CommentNote, manager: EntityManager = this.entityManager): Promise<void> {
        await manager.query(NOTE_META_COMMENT, [comment.connectionId, comment.commentId, comment.platform, comment.at])
    }
}
