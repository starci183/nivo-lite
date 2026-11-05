import type { Type } from "@nestjs/common"
import type { LeadConversationDirectory, LeadGenCommentDecisions } from "./leads.port"

/** The classes that implement the ports of the other capabilities. */
export interface LeadsPorts {
    /** Implements the decisions port; an existing provider of the app (the decisions capability). */
    readonly decisions: Type<LeadGenCommentDecisions>
    /** Implements the conversations port; an existing provider of the app (the conversations capability, which imports leads). */
    readonly conversations: Type<LeadConversationDirectory>
}

/** What the leads capability needs from the app root; the app root also decides whether it is global. */
export interface LeadsOptions {
    /** The owners of its ports. */
    readonly ports: LeadsPorts
}
