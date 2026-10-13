import { Field, ObjectType } from "@nestjs/graphql"
import { KnowledgeSourceType } from "./knowledge-source.type"

@ObjectType()
/** One document with its text. */
export class KnowledgeSourceTextType extends KnowledgeSourceType {
    /** The text (the address of a link document until it is read). */
    @Field(() => String)
    content!: string
}
