/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    workspaceHome: "/agents",
    account: "/account",
    profile: "/profile",
    workspaceNew: "/workspaces/new",
} as const

export { safeNext } from "./safe-next-path"
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
export { pathInWorkspace, workspaceHref } from "./workspace-href"
export { openWorkspaceId, workspaceIdOfAddress } from "./workspace-address"
export {
    creditsPath,
    workspaceChannelsPath,
    workspaceHandoverPath,
    workspacePaymentPath,
    workspaceReadyPath,
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
    authoritySectionPath,
    teamInviteHref,
    workItemHref,
    zaloConnectionHref,
    zaloReturnPath,
} from "./console-routes"
export { AUTOMATION_ROUTES } from "./automations-routes"
export {
    BRAIN_PARTS,
    BRAIN_PART_TABS,
    BRAIN_STRIP_TABS,
    BRAIN_TABS,
    DEFAULT_BRAIN_TAB,
    KNOWLEDGE_ROUTES,
    LEGACY_BRAIN_TABS,
    brainDossierHref,
    brainStripTabOf,
    brainTabHref,
    brainUploadHref,
    knowledgeSourceHref,
} from "./knowledge-routes"
export type { BrainPart, BrainStripTab, BrainTab } from "./knowledge-routes"
