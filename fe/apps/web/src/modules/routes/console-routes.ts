/** Console and public destinations the overview, workbench and landing surfaces link to, named once. */
export const CONSOLE_ROUTES = {
    landing: "/",
    login: "/login",
    dashboard: "/dashboard",
    chat: "/chat",
    leads: "/leads",
    newLead: "/leads?new=1",
    responsibilities: "/responsibilities",
    authority: "/authority",
    decisions: "/decisions",
    privacy: "/privacy",
    terms: "/terms",
    modules: "/modules",
    newChatbot: "/modules/new?module=chatbot",
} as const

/** The detail page of one lead. */
export const leadHref = (leadId: string): string => `/leads/${leadId}`

/** The chat page of one module agent. */
export const agentChatHref = (agentId: string): string => `/modules/${agentId}/chat`

/** The responsibilities board filtered by one query string such as `status=open`. */
export const responsibilitiesHref = (query: string): string => `${CONSOLE_ROUTES.responsibilities}?${query}`
