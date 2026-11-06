/** Console and public destinations the workbench and landing surfaces link to, named once. */
export const CONSOLE_ROUTES = {
    login: "/login",
    workspaceHome: "/agents",
    chat: "/chat",
    authority: "/authority",
    connections: "/connections",
    team: "/team",
    teamInvite: "/team?invite=1",
    permissions: "/permissions",
} as const

/** One section of the authority page. */
export const authoritySectionPath = (section: string): string => `/authority/${section}`

/** The chat page of one module agent. */
export const agentChatHref = (agentId: string, tab?: string): string => {
    const query = tab === undefined ? "" : `?tab=${tab}`
    return `/modules/${agentId}/chat${query}`
}

/** The workbench of one module, opened on one work item. */
export const workItemHref = (module: string, workItemId: string): string =>
    `/agents/${module}/workbench?focus=${workItemId}`

/** The team page opened on the invite form of one staff member. */
export const teamInviteHref = (staffId: string): string => `/team?invite_staff=${encodeURIComponent(staffId)}`

/** The page that lists the agents to add. */
export const AGENTS_ROUTE = "/agents"

/** The anchor of the roles to add on the agents page: where "Create agent" leads. */
export const AGENT_ROLES_ANCHOR = "agent-roles"

/** The roles to add on the agents page, from anywhere. */
export const AGENT_ROLES_HREF: "/agents#agent-roles" = `${AGENTS_ROUTE}#${AGENT_ROLES_ANCHOR}`

/** The chat page of one module agent opened on one tab and, when given, on one conversation. */
export const agentChatConversationHref = (agentId: string, tab: string, conversationId: string | null): string => {
    const query = new URLSearchParams({ tab })
    if (conversationId !== null) query.set("c", conversationId)
    return `${agentChatHref(agentId)}?${query.toString()}`
}

/** The profile page of one agent: who answers for it, who may give it work, whom it may tag. */
export const agentProfileHref = (agentId: string): string => `/agents/profile/${agentId}`

/** The page inside a workspace that takes the return of a Zalo OA authorization, with the query Zalo appended. */
export const zaloReturnPath = (query: Readonly<Record<string, string | undefined>>): string => {
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) if (value !== undefined) search.set(name, value)
    return search.size === 0 ? "/connections/zalo/callback" : `/connections/zalo/callback?${search.toString()}`
}

/** The page of one Zalo OA connection, on a tab when one is named. */
export const zaloConnectionHref = (connectionId: string, tab?: string): string =>
    tab === undefined ? `/connections/zalo/${connectionId}` : `/connections/zalo/${connectionId}?tab=${tab}`
