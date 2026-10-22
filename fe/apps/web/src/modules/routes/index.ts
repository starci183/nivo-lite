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

export { safeNext, safeNextPath } from "./safe-next-path"
export { LEADS_ROUTES, leadPath, newLeadPath } from "./leads-routes"
export {
    AUTH_ROUTES,
    invitePath,
    loginPath,
    loginResetPath,
    privacyHref,
    signupPath,
    termsHref,
    workspacesPath,
} from "./auth-routes"
export { ADMIN_ROUTES, adminListPath, adminWorkspacePath } from "./admin-routes"
export {
    creditsPath,
    workspaceBillingPath,
    workspacePaymentPath,
    workspaceRenewalPaymentPath,
} from "./workspace-routes"
export {
    AGENTS_ROUTE,
    CONSOLE_ROUTES,
    agentChatConversationHref,
    agentChatHref,
    agentProfileHref,
    agentSetupHref,
    leadFlowHref,
    leadHref,
    responsibilitiesHref,
    teamInviteHref,
    workItemHref,
} from "./console-routes"
export { AUTOMATION_ROUTES, automationFocusPath, newModulePath } from "./automations-routes"
export { KNOWLEDGE_ROUTES, knowledgeSourceHref } from "./knowledge-routes"
export { onPublicOrigin, requestOrigin } from "./request-origin"
