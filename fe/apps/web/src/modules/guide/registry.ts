import { AGENT_ROLES_HREF, CONSOLE_ROUTES, KNOWLEDGE_ROUTES, brainTabHref } from "@/modules/routes"
import type { GuideEntry } from "./types"

/**
 * The static index of the guide: every console route, tab and key action, written once. The words (title, hint, search phrases in
 * Vietnamese and English) live in the `guideIndex` catalog by entry id; a dotted id uses a dash there. An id here must have its words
 * in both catalogs. `target` names the element marked `data-guide-id="<target>"` that is spotlighted after the jump.
 */

const route = (id: string, href: string, managerOnly = false): GuideEntry => ({
    id,
    group: "go",
    kind: "route",
    href,
    ...(managerOnly ? { managerOnly } : {}),
})

const tab = (id: string, href: string, managerOnly = false): GuideEntry => ({ ...route(id, href, managerOnly), kind: "tab" })

const action = (id: string, href: string, target?: string, managerOnly = false): GuideEntry => ({
    id,
    group: "do",
    kind: "action",
    href,
    ...(target === undefined ? {} : { target }),
    ...(managerOnly ? { managerOnly } : {}),
})

/** The pages of the console. */
const ROUTES: ReadonlyArray<GuideEntry> = [
    route("route.overview", CONSOLE_ROUTES.workspaceHome, true),
    route("route.chat", CONSOLE_ROUTES.chat),
    route("route.brain", KNOWLEDGE_ROUTES.brain),
    route("route.knowledgeNivo", KNOWLEDGE_ROUTES.nivo),
    route("route.agents", "/agents"),
    route("route.marketplace", "/agents/marketplace", true),
    route("route.templates", "/agents/templates", true),
    route("route.team", CONSOLE_ROUTES.team, true),
    route("route.connections", CONSOLE_ROUTES.connections, true),
    route("route.sepay", "/connections/sepay", true),
    route("route.telegram", "/connections/telegram", true),
    route("route.zalo", "/connections/zalo", true),
    route("route.google", "/connections/google", true),
    route("route.drive", "/connections/drive", true),
    route("route.developers", "/developers", true),
    route("route.billing", "/billing", true),
    route("route.billingPlan", "/billing/plan", true),
    route("route.account", "/account"),
    route("route.profile", "/profile"),
]

/** The tabs of the pages: the Second Brain, the library of connections. */
const TABS: ReadonlyArray<GuideEntry> = [
    tab("tab.brainTodo", brainTabHref("todo")),
    tab("tab.brainFacts", brainTabHref("facts")),
    tab("tab.brainDocuments", brainTabHref("sources")),
    tab("tab.brainLessons", brainTabHref("lessons")),
    tab("tab.brainPublicDocs", brainTabHref("publicDocs")),
    tab("tab.brainPublicAsks", brainTabHref("publicAsks")),
    tab("tab.brainTry", brainTabHref("publicTry")),
    tab("tab.connectionsLibrary", `${CONSOLE_ROUTES.connections}?tab=library`, true),
]

/** The actions that open a wizard or lead to the button that does the work. */
const ACTIONS: ReadonlyArray<GuideEntry> = [
    action("action.createAgent", AGENT_ROLES_HREF, "agents.create", true),
    action("action.addConnection", CONSOLE_ROUTES.connections, "connections.add", true),
    action("action.addSepay", `${CONSOLE_ROUTES.connections}?connect=sepay`, undefined, true),
    action("action.addTelegram", `${CONSOLE_ROUTES.connections}?connect=telegram`, undefined, true),
    action("action.addZalo", `${CONSOLE_ROUTES.connections}?connect=zalo_oa`, undefined, true),
    action("action.addGoogle", `${CONSOLE_ROUTES.connections}?connect=google`, undefined, true),
    action("action.addSmtp", `${CONSOLE_ROUTES.connections}?connect=smtp`, undefined, true),
    action("action.addWebhook", "/developers", "connections.webhook", true),
    action("action.inviteMember", CONSOLE_ROUTES.teamInvite, "team.invite", true),
    action("action.uploadDocument", brainTabHref("sources", { add: "upload" }), "brain.upload"),
    action("action.reviewFacts", brainTabHref("facts"), "brain.review"),
    action("action.topUp", "/billing", "billing.topup", true),
    action("action.createApiKey", "/developers", "developers.keys", true),
    action("action.changePassword", "/account", "account.password"),
]

/** Every entry of the static index. */
export const GUIDE_ENTRIES: ReadonlyArray<GuideEntry> = [...ROUTES, ...TABS, ...ACTIONS]

/** The catalog key of an entry's words: a namespace key never carries a dot (it would read as nesting), so a dotted id uses a dash. */
export const indexKeyOf = (id: string): string => id.replaceAll(".", "-")
