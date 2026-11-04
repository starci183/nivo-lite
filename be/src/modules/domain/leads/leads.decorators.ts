import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LeadConversationDirectory, LeadGenCommentDecisions } from "./leads.port"

/** Token of the decisions port; the app root binds it to the decisions capability. */
export const LEADGEN_COMMENT_DECISIONS: unique symbol = Symbol("domain.leads.comment-decisions")

/** Token of the conversations port; the app root binds it to the conversations capability. */
export const LEAD_CONVERSATIONS: unique symbol = Symbol("domain.leads.conversations")

/** Injects the conversations port. Parameter type: LeadConversationDirectory. */
export const InjectLeadConversations = (): TypedParameterDecorator<LeadConversationDirectory> =>
    injector<LeadConversationDirectory>(LEAD_CONVERSATIONS)

/** Injects the decisions port. Parameter type: LeadGenCommentDecisions. */
export const InjectLeadGenCommentDecisions = (): TypedParameterDecorator<LeadGenCommentDecisions> =>
    injector<LeadGenCommentDecisions>(LEADGEN_COMMENT_DECISIONS)
