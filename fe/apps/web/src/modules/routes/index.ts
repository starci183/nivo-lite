/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    dashboard: "/dashboard",
    automations: "/automations",
    chat: "/chat",
    account: "/account",
    workspaceNew: "/workspaces/new",
    authCallback: "/auth/callback",
} as const

export { safeNextPath } from "./safe-next-path"
export { AUTH_ROUTES, invitePath, loginPath, loginResetPath, signupPath, workspacesPath } from "./auth-routes"
export { ADMIN_ROUTES, adminListPath, adminWorkspacePath } from "./admin-routes"
export { workspaceBillingPath, workspacePaymentPath } from "./workspace-routes"
export { CONSOLE_ROUTES, agentChatHref, leadHref, responsibilitiesHref } from "./console-routes"
