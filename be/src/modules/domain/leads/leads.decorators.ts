import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { LeadGenCommentDecisions } from "./leads.port"

/** Token of the decisions port; the app root binds it to the decisions capability. */
export const LEADGEN_COMMENT_DECISIONS: unique symbol = Symbol("domain.leads.comment-decisions")

/** Injects the decisions port. Parameter type: LeadGenCommentDecisions. */
export const InjectLeadGenCommentDecisions = (): TypedParameterDecorator<LeadGenCommentDecisions> =>
    injector<LeadGenCommentDecisions>(LEADGEN_COMMENT_DECISIONS)
