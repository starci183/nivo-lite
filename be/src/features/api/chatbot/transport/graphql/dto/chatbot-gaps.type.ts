import { Field, ObjectType } from "@nestjs/graphql"
import { ChatbotKnowledgeGapType } from "./chatbot-knowledge-gap.type"
import { ChatbotLensType } from "./chatbot-lens.type"

@ObjectType()
/** Open customer questions and their available agent lenses. */
export class ChatbotGapsType {
    /** The gaps value. */
    @Field(() => [ChatbotKnowledgeGapType])
    gaps!: Array<ChatbotKnowledgeGapType>

    /** The lenses value. */
    @Field(() => [ChatbotLensType])
    lenses!: Array<ChatbotLensType>
}
