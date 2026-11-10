import { Field, Int, ObjectType } from "@nestjs/graphql"
import { KnowledgeReadingWarningType } from "./knowledge-reading-warning.type"

@ObjectType()
/** How the last reading of an uploaded file went. */
export class KnowledgeSourceReadingType {
    /** The reader: text, markdown, csv, tsv, html, pdf, docx, xlsx, pptx, image, heic; file for a refused file. */
    @Field(() => String)
    reader!: string

    /** How many pages (PDF, picture) or slides it has, or null. */
    @Field(() => Int, { nullable: true })
    pageCount?: number | null

    /** How many sheets a workbook has, or null. */
    @Field(() => Int, { nullable: true })
    sheetCount?: number | null

    /** True when any of its text was transcribed by the AI from a picture (the owner should check it). */
    @Field(() => Boolean)
    transcribed!: boolean

    /** The parts it could not read whole, and the pages transcribed from pictures. */
    @Field(() => [KnowledgeReadingWarningType])
    warnings!: Array<KnowledgeReadingWarningType>

    /** The stored code of why the file was refused, or null when it was read. */
    @Field(() => String, { nullable: true })
    refusal?: string | null

    /** Why it was refused, in plain Vietnamese, or null when it was read. */
    @Field(() => String, { nullable: true })
    reason?: string | null

    /** When it was read, ISO 8601. */
    @Field(() => String)
    readAt!: string
}
