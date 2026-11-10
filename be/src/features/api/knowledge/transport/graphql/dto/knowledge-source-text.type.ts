import { Field, ObjectType } from "@nestjs/graphql"
import { KnowledgeSourceReadingType } from "./knowledge-source-reading.type"
import { KnowledgeSourceType } from "./knowledge-source.type"

@ObjectType()
/** One document with its text. */
export class KnowledgeSourceTextType extends KnowledgeSourceType {
    /** The text (the address of a link document until it is read). */
    @Field(() => String)
    content!: string

    /** How the last reading of the uploaded file went (reader, pages, sheets, transcribed pages, warnings, refusal reason); null when it has none. */
    @Field(() => KnowledgeSourceReadingType, { nullable: true })
    reading?: KnowledgeSourceReadingType | null
}
