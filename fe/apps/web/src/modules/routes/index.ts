/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    dashboard: "/dashboard",
    automations: "/automations",
    chat: "/chat",
    authCallback: "/auth/callback",
} as const

/** The chat of one agent, optionally on a tab. */
export const agentChatHref = (agentId: string, tab?: string): string =>
    `/modules/${agentId}/chat${tab === undefined ? "" : `?tab=${tab}`}`

export { safeNextPath } from "./safe-next-path"
export { CONSOLE_ROUTES, agentChatHref, leadHref, responsibilitiesHref } from "./console-routes"
