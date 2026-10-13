import { Field, Int, ObjectType } from "@nestjs/graphql"
import { DashboardFirstEventType } from "./dashboard-first-event.type"
import { DashboardPromoChatbotType } from "./dashboard-promo-chatbot.type"
import { DashboardWebsiteLeadType } from "./dashboard-website-lead.type"

@ObjectType()
/** The facts behind the onboarding checklist. */
export class DashboardPromoType {
    /** The first Chatbot agent, or null. */
    @Field(() => DashboardPromoChatbotType, { nullable: true })
    chatbot!: DashboardPromoChatbotType | null

    /** Whether the workspace bought a module inside the founding window. */
    @Field()
    isFoundingMember!: boolean

    /** The leads that came from the website. */
    @Field(() => [DashboardWebsiteLeadType])
    websiteLeads!: Array<DashboardWebsiteLeadType>

    /** The first response event per website lead. */
    @Field(() => [DashboardFirstEventType])
    firstEvents!: Array<DashboardFirstEventType>

    /** Whether a customer talked to an agent. */
    @Field()
    hasCustomerConversation!: boolean

    /** Whether a conversation is tied to a lead. */
    @Field()
    hasLeadConversation!: boolean

    /** How many drafts were approved. */
    @Field(() => Int)
    approvedCount!: number

    /** Whether a won lead has a recorded outcome. */
    @Field()
    hasWon!: boolean

    /** Whether an invoice draft was approved. */
    @Field()
    invoiceApproved!: boolean
}
