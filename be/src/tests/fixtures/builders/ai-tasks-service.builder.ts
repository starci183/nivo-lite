import type { LeadTurnInput } from "@modules/domain/ai-tasks"

/** The lead the prompts of the AI task specs write about. */
export const lead = { contact_name: "Lan", company: "ACME", channel: "telegram", need: "A quote" }

/** The agent persona the prompts of the AI task specs speak as. */
export const agent = { name: "Mai", handle: "mai", role: "Chatbot", instructions: "Be kind" }

/** The reading of a lead turn the specs hand to the model. */
export const leadTurnInput = (): LeadTurnInput => ({
    agentName: "Mai",
    agentInstructions: "Be kind",
    kind: "dm",
    text: "Can I book tomorrow?",
    name: "Lan",
    pendingQuestion: null,
    criteriaText: "Bookings are hot",
    first: true,
    voice: "",
    brief: "BUSINESS KNOWLEDGE: Bookings open at nine.",
})

/** What the AI endpoint answers besides its text, model and usage. */
export const ANSWER = { parsed: null, retrieved: 0 }

/** The usage the AI endpoint reports for one answer. */
export const USAGE = { promptTokens: 12, completionTokens: 5, totalTokens: 17, costUsd: 0.0002 }

/** A design answer the model gives as JSON text. */
export const DESIGN_JSON = '{"name":"C","handle":"c","role":"r","instructions":"i"}'

/** A responsibility the model proposes for a lead. */
export const RESPONSIBILITY = {
    title: "Follow up",
    owner_kind: "agent",
    owner_handle: "sales",
    next_action: "Call",
    due_in_days: 2,
    rationale: "routine",
}

/** A module the model designs from a description. */
export const BOT = { name: "Bot", handle: "bot", role: "Helper", instructions: "Do" }

/** An order the model reads from free text. */
export const COMBO_ORDER = { items: "Combo", amount_vnd: 1500000, confidence: 0.9 }

/** What the picture reader answers: each address inlined as a PNG data URL of itself, none dropped. */
export const dataUrls = (urls: ReadonlyArray<string>): Promise<{ images: ReadonlyArray<string>; dropped: number }> =>
    Promise.resolve({ images: urls.map((url) => `data:image/png;base64,${url}`), dropped: 0 })

/** A design answer for the module named A. */
export const DESIGN_A_JSON = '{"name":"A","handle":"a","role":"r","instructions":"i"}'
