"use server"

import { getChatbotState, getLeadWait, type ChatbotState, type LeadWait } from "./queries"

/** Read-only: does this workspace own a Chatbot? (called by client promo components) */
export const readChatbotState = async (): Promise<ChatbotState> => getChatbotState()

/** Read-only: honest wait facts for a lead. */
export const readLeadWait = async (leadId: string): Promise<LeadWait> => getLeadWait(leadId)
