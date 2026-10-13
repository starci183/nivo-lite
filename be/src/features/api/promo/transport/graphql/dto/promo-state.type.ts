import { Field, ID, ObjectType } from "@nestjs/graphql"
import { PromoOnboardingStepType } from "./onboarding-step.type"
import { WebsiteLeadStatsType } from "./website-lead-stats.type"

@ObjectType()
/** Promo and onboarding data for the active workspace. */
export class PromoStateType {
    /** Whether a chatbot is installed. */
    @Field()
    hasChatbot!: boolean

    /** The earliest installed chatbot. */
    @Field(() => ID, { nullable: true })
    chatbotAgentId!: string | null

    /** Whether a module purchase was inside the campaign window. */
    @Field()
    isFoundingMember!: boolean

    /** Website-channel lead counts and first-response delays. */
    @Field(() => WebsiteLeadStatsType)
    websiteLeadStats!: WebsiteLeadStatsType

    /** Stable step keys and their completion facts. */
    @Field(() => [PromoOnboardingStepType])
    onboarding!: Array<PromoOnboardingStepType>
}
