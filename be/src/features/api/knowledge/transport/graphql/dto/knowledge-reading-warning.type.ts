import { Field, Int, ObjectType } from "@nestjs/graphql"

@ObjectType()
/** One part of a document its last reading could not read whole. */
export class KnowledgeReadingWarningType {
    /** DOCUMENT_PAGE_UNREADABLE, DOCUMENT_PAGE_TRANSCRIBED, DOCUMENT_PAGES_OVER_LIMIT, DOCUMENT_ROWS_OVER_LIMIT or DOCUMENT_PLACE_EMPTY. */
    @Field(() => String)
    code!: string

    /** The page number, sheet name or slide number, or null for the whole document. */
    @Field(() => String, { nullable: true })
    place?: string | null

    /** The count the note names (rows read, pages left), or null. */
    @Field(() => Int, { nullable: true })
    count?: number | null

    /** The note in plain Vietnamese, e.g. "Trang 3 không đọc được.". */
    @Field(() => String)
    message!: string
}
