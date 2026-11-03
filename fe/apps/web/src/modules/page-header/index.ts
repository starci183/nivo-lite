import type { ReactNode } from "react"
import type { BreadcrumbItem, PageHeaderContent } from "@starci/grammar/common"
import { AGENTS_ROUTE, APP_ROUTES } from "@/modules/routes"

/** What the header of a console page says. */
interface PageHeadingInput {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    /** The trail, the current page last. */
    readonly crumbs: ReadonlyArray<BreadcrumbItem>
    /** The short line above the facts of the page; it takes the summary slot when `meta` is absent. */
    readonly eyebrow?: string
    readonly title: string
    readonly description: string
    /** The summary line of facts about the page subject. */
    readonly meta?: ReactNode
    readonly status?: ReactNode
    readonly mark?: ReactNode
    /** The commands of the page. */
    readonly actions?: ReactNode
    readonly tabs?: PageHeaderContent["tabs"]
}

/** The header content of a console page: trail, level-1 heading and commands, for the `header` of the page's `Page`. */
export const pageHeadingOf = (input: PageHeadingInput): PageHeaderContent => {
    const meta = input.meta ?? input.eyebrow
    return {
        title: input.title,
        description: input.description,
        breadcrumbs: { label: input.crumbLabel, items: input.crumbs },
        ...(meta !== undefined && { meta }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.mark !== undefined && { mark: input.mark }),
        ...(input.actions !== undefined && { actions: input.actions }),
        ...(input.tabs !== undefined && { tabs: input.tabs }),
    }
}

/** What the header of a console page one level under the dashboard says. */
interface HomePageHeadingInput {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    /** The first crumb: the dashboard. */
    readonly crumbHome: string
    /** The short line above the facts; absent when the title already says it. */
    readonly eyebrow?: string
    readonly title: string
    readonly description: string
}

/** The header content (dashboard, then this page) of a console page, for the `header` of the page's `Page`. */
export const homePageHeadingOf = (input: HomePageHeadingInput): PageHeaderContent =>
    pageHeadingOf({
        crumbLabel: input.crumbLabel,
        crumbs: [
            { id: "home", label: input.crumbHome, href: APP_ROUTES.dashboard },
            { id: "current", label: input.title },
        ],
        ...(input.eyebrow !== undefined && { eyebrow: input.eyebrow }),
        title: input.title,
        description: input.description,
    })

/** What the header of a page under the documents says. */
export interface KnowledgeHeadingInput {
    /** The accessible name of the trail. */
    readonly crumbLabel: string
    readonly crumbHome: string
    readonly homeHref: string
    readonly crumbBrain: string
    readonly brainHref: string
    readonly crumbDocuments: string
    readonly documentsHref: string
    /** The page itself, the last step of the trail. */
    readonly title: string
    readonly eyebrow: string
    readonly description: string
}

/** The header content (home, Second Brain, documents, this page) of a page under the documents, for the `header` of the page's `Page`. */
export const knowledgeHeadingOf = (input: KnowledgeHeadingInput): PageHeaderContent =>
    pageHeadingOf({
        crumbLabel: input.crumbLabel,
        crumbs: [
            { id: "home", label: input.crumbHome, href: input.homeHref },
            { id: "brain", label: input.crumbBrain, href: input.brainHref },
            { id: "docs", label: input.crumbDocuments, href: input.documentsHref },
            { id: "current", label: input.title },
        ],
        eyebrow: input.eyebrow,
        title: input.title,
        description: input.description,
    })

/** The words of the trail of a page under the agents page. */
interface AgentsSubpageLabels {
    /** The dashboard. */
    readonly home: string
    /** The agents page. */
    readonly agents: string
    /** The page itself. */
    readonly current: string
}

/** The trail of a page under the agents page: the dashboard, the agents and the page itself. */
export const agentsSubpageCrumbsOf = (labels: AgentsSubpageLabels): ReadonlyArray<BreadcrumbItem> => [
    { id: "home", label: labels.home, href: APP_ROUTES.dashboard },
    { id: "agents", label: labels.agents, href: AGENTS_ROUTE },
    { id: "current", label: labels.current },
]
