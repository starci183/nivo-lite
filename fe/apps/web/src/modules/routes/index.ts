/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    dashboard: "/dashboard",
    authCallback: "/auth/callback",
} as const

export { safeNextPath } from "./safe-next-path"
export { CONSOLE_ROUTES, agentChatHref, leadHref, responsibilitiesHref } from "./console-routes"
