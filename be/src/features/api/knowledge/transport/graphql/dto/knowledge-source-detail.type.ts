import { Field, ObjectType } from "@nestjs/graphql"
import { KnowledgeSourceTextType } from "./knowledge-source-text.type"
import { DocumentPassageType } from "./document-passage.type"
import { KnowledgeDocumentAiCostType } from "./knowledge-document-ai-cost.type"

@ObjectType()
/** A document with its text and its passages. */
export class KnowledgeSourceDetailType {
    /** The document. */
    @Field(() => KnowledgeSourceTextType)
    source!: KnowledgeSourceTextType

    /** Its passages in order. */
    @Field(() => [DocumentPassageType])
    chunks!: Array<DocumentPassageType>

    /** What the document cost in AI (read, critique, re-read; exact credits); null for staff. */
    @Field(() => KnowledgeDocumentAiCostType, { nullable: true })
    aiCost!: KnowledgeDocumentAiCostType | null
}
