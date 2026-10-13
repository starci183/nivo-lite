import { Field, ObjectType } from "@nestjs/graphql"
import { SuggestionDecisionType } from "./suggestion-decision.type"

@ObjectType()
/** What a workspace decided about its knowledge suggestions, and its business type. */
export class KnowledgeSuggestionContextType {
    /** The decisions. */
    @Field(() => [SuggestionDecisionType])
    decisions!: Array<SuggestionDecisionType>

    /** The business type chosen at onboarding, or null. */
    @Field(() => String, { nullable: true })
    businessType?: string | null
}
