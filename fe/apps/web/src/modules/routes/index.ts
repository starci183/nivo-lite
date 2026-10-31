/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    dashboard: "/dashboard",
    automations: "/automations",
    chat: "/chat",
    account: "/account",
    workspaceNew: "/workspaces/new",
    workspaceChannels: "/workspaces/new/channels",
    workspaceHandover: "/workspaces/new/ai",
    workspaceReady: "/workspaces/new/done",
} as const

export { safeNext } from "./safe-next-path"
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
    AGENT_ROLES_ANCHOR,
    AGENT_ROLES_HREF,
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
    zaloConnectionHref,
} from "./console-routes"
export { AUTOMATION_ROUTES, automationFocusPath, newModulePath } from "./automations-routes"
export { BRAIN_TABS, DEFAULT_BRAIN_TAB, KNOWLEDGE_ROUTES, brainTabHref, knowledgeSourceHref } from "./knowledge-routes"
export type { BrainTab } from "./knowledge-routes"
