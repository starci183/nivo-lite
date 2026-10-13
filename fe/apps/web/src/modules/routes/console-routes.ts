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
    team: "/team",
    privacy: "/privacy",
    terms: "/terms",
    modules: "/modules",
    newChatbot: "/modules/new?module=chatbot",
} as const

/** The detail page of one lead. */
export const leadHref = (leadId: string): string => `/leads/${leadId}`

/** The chat page of one module agent. */
export const agentChatHref = (agentId: string, tab?: string): string =>
    `/modules/${agentId}/chat${tab === undefined ? "" : `?tab=${tab}`}`

/** The responsibilities board filtered by one query string such as `status=open`. */
export const responsibilitiesHref = (query: string): string => `${CONSOLE_ROUTES.responsibilities}?${query}`

/** The workbench of one module, opened on one work item. */
export const workItemHref = (module: string, workItemId: string): string =>
    `/agents/${module}/workbench?focus=${workItemId}`

/** The team page opened on the invite form of one staff member. */
export const teamInviteHref = (staffId: string): string => `/team?invite_staff=${encodeURIComponent(staffId)}`

/** The page that lists the agents to add. */
export const AGENTS_ROUTE = "/agents"
