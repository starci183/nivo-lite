import { MetaCommentEntity } from "./meta-comment.entity"

export { MetaCommentEntity }

/** The entities the meta-comments capability owns, collected by the database module. */
export const metaCommentsEntities = [MetaCommentEntity] as const
