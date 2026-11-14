/** Every internal destination the foundation links to, named once. */
export const APP_ROUTES = {
    home: "/",
    login: "/login",
    workspaceHome: "/overview",
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
export { pathInWorkspace, workspaceHref } from "./workspace-href"
export { openWorkspaceId, workspaceIdOfAddress } from "./workspace-address"
export {
    creditsPath,
    billingPlanPath,
    workspaceChannelsPath,
    workspaceHandoverPath,
    workspacePaymentPath,
    workspacePlanPath,
    workspaceReadyPath,
    workspaceRenewalPaymentPath,
} from "./workspace-routes"
export { AGENTS_ROUTE, AGENT_ROLES_ANCHOR, AGENT_ROLES_HREF, CONSOLE_ROUTES, agentProfileHref, chatRoomHref, contactHref, workItemHref, zaloConnectionHref, zaloReturnPath, WORKFLOW_STEP_PARAM, workflowStepPath } from "./console-routes"
export { AUTOMATION_ROUTES } from "./automations-routes"
export {
    BRAIN_PARTS,
    BRAIN_PART_TABS,
    BRAIN_STRIP_TABS,
    DEFAULT_BRAIN_TAB,
    FIRST_PAGE,
    KNOWLEDGE_CHIPS,
    KNOWLEDGE_ROUTES,
    LEGACY_BRAIN_TABS,
    brainStripTabOf,
    brainTabHref,
    brainTabOfAddress,
    knowledgeSourceHref,
    knowledgeQuestionsHref,
} from "./knowledge-routes"
export type { BrainPart, BrainStripTab, BrainTab, KnowledgeChip } from "./knowledge-routes"
