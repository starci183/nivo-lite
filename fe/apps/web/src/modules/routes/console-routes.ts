/** Console and public destinations the workbench and landing surfaces link to, named once. */
export const CONSOLE_ROUTES = {
    login: "/login",
    workspaceHome: "/overview",
    chat: "/chat",
    contacts: "/contacts",
    connections: "/connections",
    team: "/team",
    teamInvite: "/team?invite=1",
} as const

/** The workbench of one module, opened on one work item. */
export const workItemHref = (module: string, workItemId: string): string =>
    `/agents/${module}/workbench?focus=${workItemId}`

/** The page that lists the agents to add. */
export const AGENTS_ROUTE = "/agents"

/** The anchor of the roles to add on the agents page: where "Create agent" leads. */
export const AGENT_ROLES_ANCHOR = "agent-roles"

/** The roles to add on the agents page, from anywhere. */
export const AGENT_ROLES_HREF: "/agents#agent-roles" = `${AGENTS_ROUTE}#${AGENT_ROLES_ANCHOR}`

/** The profile page of one agent: who answers for it, who may give it work, whom it may tag. */
export const agentProfileHref = (agentId: string): string => `/agents/profile/${agentId}`

/** The page inside a workspace that takes the return of a Zalo OA authorization, with the query Zalo appended. */
export const zaloReturnPath = (query: Readonly<Record<string, string | undefined>>): string => {
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries(query)) if (value !== undefined) search.set(name, value)
    return search.size === 0 ? "/connections/zalo/callback" : `/connections/zalo/callback?${search.toString()}`
}

/** The page of one Zalo OA connection: the account's page on the one provider template (its Cau hinh tab). */
export const zaloConnectionHref = (connectionId: string): string => `/connections/open/${connectionId}`

/** The page of one person the agents work with: the people list with this person open. */
export const contactHref = (contactId: string): string => `${CONSOLE_ROUTES.contacts}/${encodeURIComponent(contactId)}`

/** The team chat opened on one room. */
export const chatRoomHref = (roomId: string): string => `${CONSOLE_ROUTES.chat}?room=${encodeURIComponent(roomId)}`

/** The query parameter of a workflow's map that opens one step's panel (the node panel of rights). */
export const WORKFLOW_STEP_PARAM = "step"

/** The Quyen tab of one agent: the accounts it is attached to and what its steps call. */
export const agentRightsPath = (module: string, installationId: string): string =>
    `${AGENTS_ROUTE}/${module}/${installationId}/connections`

/** One step of one workflow of an agent: the workflow's map with that step's panel open. */
export const workflowStepPath = (module: string, installationId: string, workflowKey: string, nodeKey: string): string =>
    `${AGENTS_ROUTE}/${module}/${installationId}/workflows/${encodeURIComponent(workflowKey)}/map?${WORKFLOW_STEP_PARAM}=${encodeURIComponent(nodeKey)}`
