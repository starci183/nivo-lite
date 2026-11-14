import type { PageHeaderBreadcrumbs, PageHeaderContent } from "@starci/grammar/common"
import { APP_ROUTES, workspaceHref } from "@/modules/routes"

/** The link of a header item inside the workspace, or none while the page only draws its loading state (a loading boundary knows no workspace). */
const linkIn = (workspaceId: string | undefined, path: string): { readonly href?: string } =>
    workspaceId === undefined ? {} : { href: workspaceHref(workspaceId, path) }

/** What the header of the two personal pages (profile, account) says. */
interface AccountHeadingInput {
    /** The workspace the tabs link within; none while the page only draws its loading state. */
    readonly workspaceId?: string | undefined
    /** Names the trail landmark. */
    readonly crumbLabel: string
    /** The dashboard crumb. */
    readonly home: string
    readonly title: string
    readonly description: string
    /** The accessible name of the tab strip. */
    readonly tabsLabel: string
    readonly profileLabel: string
    readonly accountLabel: string
    /** The page that draws this header. */
    readonly selected: "profile" | "account"
}

/** The header content of a personal page: the trail (the dashboard, then the page), title, line and the profile / account tabs (link tabs). */
export const accountHeadingOf = (input: AccountHeadingInput): PageHeaderContent => ({
    breadcrumbs: consoleBreadcrumbsOf({
        workspaceId: input.workspaceId,
        label: input.crumbLabel,
        home: input.home,
        current: input.title,
    }),
    title: input.title,
    description: input.description,
    tabs: {
        label: input.tabsLabel,
        selectedKey: input.selected,
        labelVisibility: "always",
        items: [
            { id: "profile", label: input.profileLabel, ...linkIn(input.workspaceId, APP_ROUTES.profile) },
            { id: "account", label: input.accountLabel, ...linkIn(input.workspaceId, APP_ROUTES.account) },
        ],
    },
})

/** One ancestor of a console page between the dashboard and the page itself. */
interface ConsoleTrailStep {
    readonly id: string
    readonly label: string
    /** The route of the ancestor inside the workspace. */
    readonly path: string
}

/** The words of the trail of a console page. */
interface ConsoleBreadcrumbsInput {
    /** The workspace the trail links within; none while the page only draws its skeleton (a loading boundary knows no workspace). */
    readonly workspaceId?: string | undefined
    /** Names the trail landmark. */
    readonly label: string
    /** The dashboard. */
    readonly home: string
    /** The ancestors between the dashboard and the page, nearest the dashboard first. */
    readonly trail?: ReadonlyArray<ConsoleTrailStep>
    /** The page itself. */
    readonly current: string
}

/** The trail of a console page: the dashboard, its ancestors and the page itself (the last crumb, with no link). */
export const consoleBreadcrumbsOf = (input: ConsoleBreadcrumbsInput): PageHeaderBreadcrumbs => ({
    label: input.label,
    items: [
        {
            id: "home",
            label: input.home,
            ...linkIn(input.workspaceId, APP_ROUTES.workspaceHome),
        },
        ...(input.trail ?? []).map((step) => ({
            id: step.id,
            label: step.label,
            ...linkIn(input.workspaceId, step.path),
        })),
        { id: "current", label: input.current },
    ],
})
