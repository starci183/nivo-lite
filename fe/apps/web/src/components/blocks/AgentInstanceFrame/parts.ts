import type { ReactNode } from "react"
import type { PageFrameTabs } from "@nivo-lite/agent-sdk/client"
import type { BadgeTone, BreadcrumbItem } from "@starci/grammar/common"
import type { ConnectionNeedsProps } from "@/components/leaves/ConnectionNeeds"
import type { useTranslations } from "next-intl"
import type { useAgentWorkView } from "@/hooks/agentWork"
import type { useConnectionNeedsCopy, useInstanceHeader } from "@/hooks/installations"
import { AGENTS_ROUTE, APP_ROUTES, workspaceHref } from "@/modules/routes"

/** What the header shows once the instance is known, every word resolved. */
export interface InstanceHeaderView {
    readonly name: string
    /** The kind of the agent: its mark is the glyph of the kind on the soft colour of the kind. */
    readonly module: string
    readonly isEarly: boolean
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    /** "@handle - kind - granted accounts", already joined. */
    readonly subtitle: string
    /** What a `needs_connection` agent waits for and where to connect it; no lines otherwise. */
    readonly needs: ConnectionNeedsProps
    /** The one primary command of the open tab (add a connection on Ket noi); null on a tab that has none. */
    readonly primary: { readonly label: string; readonly href: string } | null
    /** The profile of the agent that drives this instance; null while the instance has no agent. */
    readonly profileHref: string | null
    /** The packaging page of this agent's workflow; null for a person who may not package. */
    readonly packageHref: string | null
}

/** One installed agent the switcher in the header can open. */
export interface InstanceSwitchItem {
    readonly id: string
    readonly name: string
    readonly seed: string
    readonly avatarUrl: string | null
    /** "role · status", already joined. */
    readonly description: string
    readonly href: string
}

/** The switcher of the installed agents: the agents, the current one, and the way to add another. */
export interface InstanceSwitch {
    readonly label: string
    readonly items: ReadonlyArray<InstanceSwitchItem>
    readonly currentId: string
    /** The way to add another agent; null for a person who may not install agents. */
    readonly add: { readonly label: string; readonly href: string } | null
}
/** The second tab row of the routed tab (the views of Work). */
export interface FrameSubTabs {
    readonly label: string
    readonly items: ReadonlyArray<{
        readonly id: string
        readonly label: string
        readonly count?: number
        readonly isAttention?: boolean
    }>
    readonly selectedKey: string
    readonly onSelect: (key: string) => void
    /** The panel the tabs control, when it is not the page body. */
    readonly panelId?: string | ((key: string) => string)
    /** A command at the end of the row. */
    readonly end?: ReactNode
}

/** The path of the page of one run, below the Work tab: the run is the segment after `runs`. */
export const RUN_PATH: RegExp = /\/work\/runs\/([^/?#]+)/

/** The path of the page of one version of a workflow, below the workflows tab: the workflow key, then the version number. */
export const VERSION_PATH: RegExp = /(\/workflows\/([^/?#]+))\/versions\/(\d+)/

/** The crumb of the open version of a workflow, from the path; null when the path names no version. */
export const versionCrumbOf = (
    pathname: string,
    words: ReturnType<typeof useTranslations<"agentWorkflowPages">>,
): AgentCrumbsInput["version"] => {
    const match = VERSION_PATH.exec(pathname)
    if (match === null) return null
    return {
        workflowLabel: words("crumbWorkflow"),
        workflowHref: `${pathname.slice(0, (match.index ?? 0) + (match[1] ?? "").length)}/versions`,
        label: words("crumbVersion", { number: match[3] ?? "" }),
    }
}

/** What the crumbs of the agent need: its name, and the run and the Work tab when a run is open. */
interface AgentCrumbsInput {
    readonly header: ReturnType<typeof useInstanceHeader>
    readonly isLoading: boolean
    readonly runId: string | null
    readonly workspaceId: string
    readonly module: string
    readonly installationId: string
    readonly workLabel: string
    readonly workHref: string
    readonly runLabel: string
    /** The version of a workflow that is open: the way back to the versions of that workflow, and its own crumb; null on any other page. */
    readonly version: {
        readonly workflowLabel: string
        readonly workflowHref: string
        readonly label: string
    } | null
}

/** The crumbs from the agent on: its name (a link when a run is open), and the Work tab and the run under it. */
export const agentCrumbsOf = (input: AgentCrumbsInput): ReadonlyArray<BreadcrumbItem> => {
    const { header, runId, version } = input
    if (input.isLoading) return [{ id: "agent", label: "", isLoading: true }]
    const agent = {
        id: "agent",
        label: header.name === "" ? header.typeName : header.name,
        ...(runId === null
            ? {}
            : { href: workspaceHref(input.workspaceId, `${AGENTS_ROUTE}/${input.module}/${input.installationId}`) }),
    }
    if (version !== null)
        return [
            {
                ...agent,
                href: workspaceHref(input.workspaceId, `${AGENTS_ROUTE}/${input.module}/${input.installationId}`),
            },
            { id: "workflow", label: version.workflowLabel, href: version.workflowHref },
            { id: "version", label: version.label },
        ]
    return runId === null
        ? [agent]
        : [agent, { id: "work", label: input.workLabel, href: input.workHref }, { id: "run", label: input.runLabel }]
}

/** What the second tab row of the Work tab needs: whether it shows, the words of the Work tab and the view in the url. */
interface SubTabsInput {
    readonly isShown: boolean
    readonly words: ReturnType<typeof useTranslations<"agentWork">>
    readonly work: ReturnType<typeof useAgentWorkView>
}

/** The second tab row of the Work tab (the work and the runs); none on the page of a run, where the crumbs carry the way back. */
export const subTabsOf = (input: SubTabsInput): FrameSubTabs | null =>
    input.isShown
        ? {
              label: input.words("viewsLabel"),
              items: [
                  { id: "work", label: input.words("viewWork") },
                  { id: "runs", label: input.words("viewRuns") },
              ],
              selectedKey: input.work.view,
              onSelect: (view: string) => input.work.select(view === "runs" ? "runs" : "work"),
          }
        : null

/** What the second tab row of the Setup tab needs: whether it shows, the words, which section the url names and the way to another. */
interface SetupSubTabsInput {
    /** The tab the route names, and the path . */
    readonly selected: string
    readonly pathname: string
    readonly words: ReturnType<typeof useTranslations<"agentWorkflows">>
    /** The route of the setup tab; the workflows section is below it. */
    readonly setupHref: string
    readonly push: (href: string) => void
}

/** Which section of Setup the path names: the guide when it names neither of the others. */
const setupSectionOf = (pathname: string): "setup" | "general" =>
    pathname.includes("/setup/general") ? "general" : "setup"

/** The second tab row of the Setup tab: the guide and its general section (name, hours, limits). */
export const setupSubTabsOf = (input: SetupSubTabsInput): FrameSubTabs | null =>
    input.selected === "setup"
        ? {
              label: input.words("tabsLabel"),
              items: [
                  { id: "setup", label: input.words("tabSetup") },
                  { id: "general", label: input.words("tabGeneral") },
              ],
              selectedKey: setupSectionOf(input.pathname),
              onSelect: (key: string) => input.push(key === "setup" ? input.setupHref : `${input.setupHref}/${key}`),
          }
        : null

/** What the second tab row of a workflow page needs: the tab the route names, the path, the words and the way to another part. */
interface WorkflowSubTabsInput {
    readonly selected: string
    readonly pathname: string
    readonly words: ReturnType<typeof useTranslations<"agentWorkflowPages">>
    readonly push: (href: string) => void
}

/** The page of one workflow under the workflows tab: its key, and the part after it (none for "In and Out"). */
const WORKFLOW_PATH = /^(.*\/workflows\/[^/]+?)(?:\/(map|versions|runs))?$/

/** The second tab row of the page of one workflow: In and Out, the map, the versions and the runs, each its own route. */
export const workflowSubTabsOf = (input: WorkflowSubTabsInput): FrameSubTabs | null => {
    const match = input.selected === "workflows" ? WORKFLOW_PATH.exec(input.pathname) : null
    if (match === null) return null
    const base = match[1] ?? ""
    return {
        label: input.words("tabsLabel"),
        items: [
            { id: "io", label: input.words("tabIO") },
            { id: "map", label: input.words("tabMap") },
            { id: "versions", label: input.words("tabVersions") },
            { id: "runs", label: input.words("tabRuns") },
        ],
        selectedKey: match[2] ?? "io",
        onSelect: (key: string) => input.push(key === "io" ? base : `${base}/${key}`),
    }
}

/** What the header view of an agent needs: the instance read, its placeholder, the words and where the person is. */
interface InstanceViewInput {
    readonly resolved: ReturnType<typeof useInstanceHeader>["slot"] extends infer Slot
        ? Slot extends { readonly items: infer Items }
            ? Items | undefined
            : undefined
        : undefined
    readonly placeholder: InstanceHeaderView
    readonly t: ReturnType<typeof useTranslations<"modulesCore">>
    readonly needs: ReturnType<typeof useConnectionNeedsCopy>
    readonly module: string
    readonly installationId: string
    readonly workspaceId: string
    readonly canPackage: boolean
}

/** The header view of an agent: its name, status and facts, what it still needs, and the one command and the links its tab offers. */
export const instanceViewOf = (input: InstanceViewInput): InstanceHeaderView => {
    const { resolved, t, needs } = input
    if (resolved === undefined) return input.placeholder
    return {
        name: resolved.name,
        module: input.module,
        isEarly: resolved.isEarly,
        statusLabel: t(`lifecycle_${resolved.lifecycle}`),
        statusTone: resolved.statusTone,
        subtitle: resolved.subtitle,
        needs: { lines: needs.linesOf(resolved.connectionNeeds), linkLabel: needs.linkLabel, href: needs.href },
        primary: null,
        profileHref: resolved.profileHref,
        packageHref: input.canPackage
            ? workspaceHref(input.workspaceId, `${AGENTS_ROUTE}/templates/package/${input.installationId}`)
            : null,
    }
}

/** What the one second tab row of the frame needs: the route, the Work view, the tabs a workbench hands up, and the words of each section. */
interface FrameSubTabsInput {
    readonly selected: string
    readonly pathname: string
    readonly runId: string | null
    readonly work: ReturnType<typeof useAgentWorkView>
    readonly viewTabs: PageFrameTabs | null
    readonly words: {
        readonly work: SubTabsInput["words"]
        readonly setup: SetupSubTabsInput["words"]
        readonly workflow: WorkflowSubTabsInput["words"]
    }
    readonly setupHref: string
    readonly push: (href: string) => void
}

/** The second tab row of the open tab: the views of Work, the sections of Setup, the parts of a workflow, or the views a workbench hands up. */
export const frameSubTabsOf = (input: FrameSubTabsInput): FrameSubTabs | null => {
    const { selected, pathname, push, viewTabs } = input
    const own =
        subTabsOf({
            isShown: selected === "work" && input.runId === null,
            words: input.words.work,
            work: input.work,
        }) ??
        setupSubTabsOf({ selected, pathname, words: input.words.setup, setupHref: input.setupHref, push }) ??
        workflowSubTabsOf({ selected, pathname, words: input.words.workflow, push })
    if (own !== null || selected !== "workbench" || viewTabs === null) return own
    return {
        label: viewTabs.label,
        items: viewTabs.items,
        selectedKey: viewTabs.selectedKey ?? viewTabs.items[0]?.id ?? "",
        onSelect: viewTabs.onSelect,
        panelId: viewTabs.panelId,
        end: viewTabs.end,
    }
}

/** The count a tab carries: the grants on Ket noi, the facts that wait for the owner on Tri thuc (they read as needing attention). */
const countOf = (
    tab: string,
    counts: ReturnType<typeof useInstanceHeader>["counts"],
): { readonly count?: number; readonly isAttention?: boolean } => {
    if (tab === "connections") return counts.grants === undefined ? {} : { count: counts.grants }
    if (tab === "knowledge" && counts.waitingFacts !== undefined)
        return { count: counts.waitingFacts, isAttention: counts.waitingFacts > 0 }
    return {}
}

/** A link tab of the instance band, with the count it may carry. */
export interface InstanceTab {
    readonly id: string
    readonly label: string
    readonly href: string
    readonly count?: number
    readonly isAttention?: boolean
}

/** One link tab of the instance band: its label and address, with the count the tab carries. */
export const tabOf = (
    id: string,
    label: string,
    href: string,
    counts: ReturnType<typeof useInstanceHeader>["counts"],
): InstanceTab => ({ id, label, href, ...countOf(id, counts) })

/** What the first two crumbs need: the words of the shell and of the modules, and the workspace. */
interface RootCrumbsInput {
    readonly shell: ReturnType<typeof useTranslations<"shell">>
    readonly modules: ReturnType<typeof useTranslations<"modulesCore">>
    readonly workspaceId: string
}

/** The crumbs before the agent: home and the catalog of agents. */
export const rootCrumbsOf = (input: RootCrumbsInput): ReadonlyArray<BreadcrumbItem> => [
    { id: "home", label: input.shell("crumbHome"), href: workspaceHref(input.workspaceId, APP_ROUTES.workspaceHome) },
    { id: "modules", label: input.modules("catalogTitle"), href: workspaceHref(input.workspaceId, AGENTS_ROUTE) },
]
