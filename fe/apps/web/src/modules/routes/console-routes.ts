/** Console and public destinations the overview, workbench and landing surfaces link to, named once. */
export const CONSOLE_ROUTES = {
    login: "/login",
    dashboard: "/dashboard",
    chat: "/chat",
    leads: "/leads",
    newLead: "/leads?new=1",
    responsibilities: "/responsibilities",
    authority: "/authority",
    decisions: "/decisions",
    connections: "/connections",
    team: "/team",
    permissions: "/permissions",
    modules: "/modules",
    newChatbot: "/modules/new?module=chatbot",
} as const

/** The detail page of one lead. */
export const leadHref = (leadId: string): string => `/leads/${leadId}`

/** The chat page of one module agent. */
export const agentChatHref = (agentId: string, tab?: string): string => {
    const query = tab === undefined ? "" : `?tab=${tab}`
    return `/modules/${agentId}/chat${query}`
}

/** The responsibilities board filtered by one query string such as `status=open`. */
export const responsibilitiesHref = (query: string): string => `${CONSOLE_ROUTES.responsibilities}?${query}`

/** The workbench of one module, opened on one work item. */
export const workItemHref = (module: string, workItemId: string): string =>
    `/agents/${module}/workbench?focus=${workItemId}`

/** The team page opened on the invite form of one staff member. */
export const teamInviteHref = (staffId: string): string => `/team?invite_staff=${encodeURIComponent(staffId)}`

/** The page that lists the agents to add. */
export const AGENTS_ROUTE = "/agents"

/** The setup page of one module agent. */
export const agentSetupHref = (agentId: string): string => `${CONSOLE_ROUTES.modules}/${agentId}`

/** The work flow of one lead, where a handed-over customer chat leads. */
export const leadFlowHref = (leadId: string): string => `${leadHref(leadId)}#flow`

/** The chat page of one module agent opened on one tab and, when given, on one conversation. */
export const agentChatConversationHref = (agentId: string, tab: string, conversationId: string | null): string => {
    const query = new URLSearchParams({ tab })
    if (conversationId !== null) query.set("c", conversationId)
    return `${agentChatHref(agentId)}?${query.toString()}`
}

/** The profile page of one agent: who answers for it, who may give it work, whom it may tag. */
export const agentProfileHref = (agentId: string): string => `/agents/profile/${agentId}`

/** The page of one Zalo OA connection, on a tab when one is named. */
export const zaloConnectionHref = (connectionId: string, tab?: string): string =>
    tab === undefined ? `/connections/zalo/${connectionId}` : `/connections/zalo/${connectionId}?tab=${tab}`
