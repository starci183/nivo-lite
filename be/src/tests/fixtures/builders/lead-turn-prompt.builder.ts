import type { LeadTurnInput } from "@modules/integrations/deepseek"

/** A returning customer asking about the service price in a public comment. */
export const priceComment = (input: LeadTurnInput): LeadTurnInput => ({
    ...input,
    agentName: "Mai",
    agentInstructions: "Be kind",
    kind: "comment",
    text: "What does it cost?",
    name: "Lan",
    pendingQuestion: "Which service?",
    criteriaText: "Repeat customers are hot",
    voice: "Friendly",
    brief: "BUSINESS KNOWLEDGE: Service costs 100.",
})
