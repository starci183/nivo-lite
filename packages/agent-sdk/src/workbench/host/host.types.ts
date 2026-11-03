import type { ForbiddenTest, SlotRead } from "../../slot/slot.types"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView } from "../view/view.types"

/** The values a message interpolates. */
export type WorkbenchMessageValues = Readonly<Record<string, string | number>>

/** Translates a key of one message namespace; the host owns the catalogue, the locale and the plural rules. */
export type WorkbenchTranslate = (key: string, values?: WorkbenchMessageValues) => string

/** Locale-aware formatting the host owns: a module never formats a number, a date or money itself. */
export interface WorkbenchFormat {
    readonly number: (value: number) => string
    readonly money: (valueVnd: number) => string
    readonly dateTime: (iso: string, style: "date" | "dateTime" | "time") => string
    readonly relative: (iso: string) => string
}

/** The words and formats of the viewer's locale. */
export interface WorkbenchI18nPort {
    /** A hook: the translator of one namespace (a module reads its own namespace and the shared ones it is given). */
    readonly useText: (namespace: string) => WorkbenchTranslate
    /** A hook: the formatters of the viewer's locale. */
    readonly useFormat: () => WorkbenchFormat
    /** A hook: the viewer's product language, for words an owner wrote into a spec. */
    readonly useLocale: () => "vi" | "en"
    /** A hook: the words of the data-status recipe, with the empty sentence of one region. */
    readonly useSlotWords: () => (empty: string) => {
        readonly empty: string
        readonly forbidden: string
        readonly error: string
        readonly retry: string
    }
}

/**
 * One operation of the host's API that a module may run: its name in the host's operation allowlist and the document the host sends.
 * The phantom members carry the types of the variables and of the data; they are never read at runtime.
 */
export interface WorkbenchOperation<TData, TVariables> {
    readonly kind: "query" | "mutation"
    /** The operation name; the host refuses a name its allowlist does not hold for the module. */
    readonly name: string
    /** The GraphQL document text. */
    readonly document: string
    readonly __data?: TData
    readonly __variables?: TVariables
}

/** A read through the host: its status, and the way to read it again. */
export interface WorkbenchQuery<TData> extends SlotRead<TData> {
    readonly reload: () => Promise<TData | undefined>
}

/** Why a command failed, in the host's outcome vocabulary. */
export type WorkbenchFailureReason = "forbidden" | "invalid" | "conflict" | "not_found" | "failed"

/** The outcome of a command: the data, or the reason with words the viewer can read. */
export type WorkbenchOutcome<TData> =
    | { readonly ok: true; readonly data: TData }
    | { readonly ok: false; readonly reason: WorkbenchFailureReason; readonly message: string }

/** A command through the host: run it, and whether one is running. */
export interface WorkbenchCommand<TData, TVariables> {
    readonly run: (variables: TVariables) => Promise<WorkbenchOutcome<TData>>
    readonly isRunning: boolean
}

/** The reads and writes of a module, through the host's cache and transport; a module imports neither. */
export interface WorkbenchDataPort {
    /** A hook: one read, keyed by the workspace and the variables; null variables do not fetch (an inactive region). */
    readonly useQuery: <TData, TVariables>(
        operation: WorkbenchOperation<TData, TVariables>,
        variables: TVariables | null,
    ) => WorkbenchQuery<TData>
    /**
     * A hook: one read by operation name alone, for a spec; the host resolves the name in the module's allowlist, answers the value of
     * the operation's one root field, and does not fetch for null variables.
     */
    readonly useNamedQuery: (
        name: string,
        variables: Readonly<Record<string, string | number | boolean | null>> | null,
    ) => WorkbenchQuery<unknown>
    /** A hook: one command by operation name alone, for a spec; it runs with the id of the record it is bound on. */
    readonly useNamedCommand: (name: string) => WorkbenchCommand<unknown, { readonly id: string }>
    /** A hook: one command; on success the host refreshes the reads named in `refreshes` of the same workspace. */
    readonly useCommand: <TData, TVariables>(
        operation: WorkbenchOperation<TData, TVariables>,
        refreshes: ReadonlyArray<string>,
    ) => WorkbenchCommand<TData, TVariables>
    /** Tells a forbidden failure from any other. */
    readonly isForbidden: ForbiddenTest
}

/** Where a module may send the viewer, and the query of the current route. */
export interface WorkbenchNavigationPort {
    /** The href of a path inside the console, with the locale and workspace the host adds. */
    readonly href: (path: string) => string
    /** A hook: the value of one query key of the current route, null when absent. */
    readonly useQueryValue: (key: string) => string | null
    /** Replaces one query key without a navigation; null removes it. */
    readonly setQueryValue: (key: string, value: string | null) => void
}

/** What the viewer may do. */
export interface WorkbenchPermissionPort {
    /** A hook: whether the viewer holds one permission of the module's declared list. */
    readonly useCan: (permission: string) => boolean
    /** A hook: whether the viewer may decide a work item assigned to this staff id (null: anyone with the right). */
    readonly useCanDecide: (assignedStaffId: string | null) => boolean
}

/** A short notice to the viewer after a command. */
export interface WorkbenchFeedbackPort {
    readonly notify: (tone: "success" | "danger" | "neutral", message: string) => void
}

/** What the host's shell gives every workbench: the tabs of the route, the dashboard frame and the why pane. */
export interface WorkbenchShellState<TTab extends string> {
    readonly selectedTab: TTab
    readonly selectTab: (id: string) => void
    /** False while the why pane explains one work item; the workbench then draws its explanation shape. */
    readonly isNormal: boolean
    readonly why: WorkbenchExplanationView & { readonly label: string }
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    /** Tells one workspace and instance from another, so a module's local state resets when it changes. */
    readonly scope: string
    /** The active workspace; undefined before the session is read. */
    readonly workspaceId: string | undefined
}

/** The route a workbench opens on. */
export interface WorkbenchShellInput<TTab extends string> {
    readonly module: string
    readonly installationId: string
    readonly tabs: readonly [TTab, ...TTab[]]
    readonly initialTab: string | null
}

/** The shell port: one hook. */
export interface WorkbenchShellPort {
    readonly useShell: <TTab extends string>(input: WorkbenchShellInput<TTab>) => WorkbenchShellState<TTab>
}

/**
 * Everything a module's workbench may reach outside itself, as ports the host implements. In process the host binds them to its own
 * SWR, GraphQL, i18n, router and session; in an iframe sandbox the same ports cross a message channel. A module that reads anything
 * else is refused at review.
 */
export interface WorkbenchHost {
    readonly i18n: WorkbenchI18nPort
    readonly data: WorkbenchDataPort
    readonly navigation: WorkbenchNavigationPort
    readonly permissions: WorkbenchPermissionPort
    readonly feedback: WorkbenchFeedbackPort
    readonly shell: WorkbenchShellPort
}
