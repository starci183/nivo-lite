import type { BreadcrumbItem, PageHeaderContent } from "@starci/grammar/common"
import { AGENTS_ROUTE, APP_ROUTES, workspaceHref } from "@/modules/routes"

/** The words of the trail of a page under the agents page. */
interface AgentsSubpageLabels {
    /** The workspace the trail links within. */
    readonly workspaceId: string
    /** The dashboard. */
    readonly home: string
    /** The agents page. */
    readonly agents: string
    /** The page itself. */
    readonly current: string
}

/** The trail of a page under the agents page: the dashboard, the agents and the page itself. */
export const agentsSubpageCrumbsOf = (labels: AgentsSubpageLabels): ReadonlyArray<BreadcrumbItem> => [
    { id: "home", label: labels.home, href: workspaceHref(labels.workspaceId, APP_ROUTES.dashboard) },
    { id: "agents", label: labels.agents, href: workspaceHref(labels.workspaceId, AGENTS_ROUTE) },
    { id: "current", label: labels.current },
]

/** What the header of the two personal pages (profile, account) says. */
interface AccountHeadingInput {
    /** The workspace the tabs link within. */
    readonly workspaceId: string
    readonly title: string
    readonly description: string
    /** The accessible name of the tab strip. */
    readonly tabsLabel: string
    readonly profileLabel: string
    readonly accountLabel: string
    /** The page that draws this header. */
    readonly selected: "profile" | "account"
}

/** The header content of a personal page: title, line and the profile / account tabs (link tabs), with no trail. */
export const accountHeadingOf = (input: AccountHeadingInput): PageHeaderContent => ({
    title: input.title,
    description: input.description,
    tabs: {
        label: input.tabsLabel,
        selectedKey: input.selected,
        labelVisibility: "always",
        items: [
            { id: "profile", label: input.profileLabel, href: workspaceHref(input.workspaceId, APP_ROUTES.profile) },
            { id: "account", label: input.accountLabel, href: workspaceHref(input.workspaceId, APP_ROUTES.account) },
        ],
    },
})

/** The three tabs of the Agent page: the running agents, the marketplace and the caller's own templates (the owner's ruling: templates are a tab of Agent). */
type AgentPageTab = "running" | "marketplace" | "templates"

/** The words of the three tabs. */
interface AgentPageTabsInput {
    /** The workspace the tabs link within. */
    readonly workspaceId: string
    readonly label: string
    readonly selected: AgentPageTab
    readonly runningLabel: string
    readonly marketplaceLabel: string
    readonly templatesLabel: string
}

/** The `tabs` of the header of the Agent page, a link tab per view. */
export const agentPageTabsOf = (input: AgentPageTabsInput): NonNullable<PageHeaderContent["tabs"]> => ({
    label: input.label,
    labelVisibility: "always",
    selectedKey: input.selected,
    items: [
        { id: "running", label: input.runningLabel, href: workspaceHref(input.workspaceId, AGENTS_ROUTE) },
        {
            id: "marketplace",
            label: input.marketplaceLabel,
            href: workspaceHref(input.workspaceId, `${AGENTS_ROUTE}/marketplace`),
        },
        {
            id: "templates",
            label: input.templatesLabel,
            href: workspaceHref(input.workspaceId, `${AGENTS_ROUTE}/templates`),
        },
    ],
})
