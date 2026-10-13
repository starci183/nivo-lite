/** The workspace's earliest chatbot, when one is installed. */
export interface PromoChatbotState {
    /** Whether the workspace owns a chatbot. */
    readonly hasChatbot: boolean
    /** The earliest installed chatbot identifier, when present. */
    readonly agentId: string | null
    /** The installed chatbot handle, when present. */
    readonly handle: string | null
    /** The installed chatbot display name, when present. */
    readonly name: string | null
}

/** Website lead counts and their recorded response delay. */
export interface WebsiteLeadStats {
    /** The number of website-channel leads. */
    readonly count: number
    /** Website leads captured outside the product opening hours. */
    readonly afterHoursCount: number
    /** The mean hours to the first recorded approval or assignment. */
    readonly avgWaitHours: number | null
}

/** A data-backed onboarding step; the browser translates its stable key. */
export interface PromoOnboardingStep {
    /** The stable frontend translation key of the onboarding step. */
    readonly key: string
    /** Whether recorded workspace data completes this step. */
    readonly done: boolean
    /** The destination for performing the onboarding step. */
    readonly href: string
}

/** Facts used by the campaign and onboarding surfaces. */
export interface PromoState {
    /** Whether the workspace owns a chatbot. */
    readonly hasChatbot: boolean
    /** The earliest installed chatbot identifier, when present. */
    readonly chatbotAgentId: string | null
    /** Whether a module purchase falls inside the founding campaign window. */
    readonly isFoundingMember: boolean
    /** The website lead counts and recorded response delay. */
    readonly websiteLeadStats: WebsiteLeadStats
    /** The ordered onboarding steps and completion facts. */
    readonly onboarding: ReadonlyArray<PromoOnboardingStep>
}

/** The delay shown for a website lead in a workspace without a chatbot. */
export interface LeadWait {
    /** Whether the website lead wait note applies. */
    readonly show: boolean
    /** Whole hours waiting, when at least one hour is recorded. */
    readonly hours: number | null
    /** Whether an approved reply exists. */
    readonly replied: boolean
}
