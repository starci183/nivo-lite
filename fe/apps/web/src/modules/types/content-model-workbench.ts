import type { DataSlot, SlotLabels } from "./slot"
import type { PostView, QuoteView } from "./content"
import type { ContentNoteView } from "./content-editor"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { ContentWorkbenchCopy } from "./content-model-workbench-copy"
import type {
    ContentCommandViews,
    ContentCommandActions,
    ContentSettingsViews,
    ContentSettingsActions,
} from "./content-model-workbench-forms"
import type { ContentEditorFields, ContentEditorActions } from "./content-model-workbench-editor"

/** Original Content strip order, independent of any world hook. */
export const CONTENT_TABS = ["calendar", "list", "queue", "balance", "settings"] as const
/** Resolved tab facts supplied by the connected content owner. */
export type ContentTab = (typeof CONTENT_TABS)[number]
/** Resolved workbench facts supplied by the connected content owner. */
type ContentWorkbenchShape = ContentTab | "explanation"
/** One resolved calendar cell, with full date and chip words. */
export interface ContentCalendarCell {
    readonly key: string
    readonly day: number | null
    readonly dateKey: string
    readonly label: string
    readonly posts: ReadonlyArray<PostView & { readonly pickLabel: string }>
    readonly moreLabel: string | null
}
/** Resolved calendar facts supplied by the connected content owner. */
export interface ContentCalendarFields {
    readonly copy: ContentWorkbenchCopy
    readonly weekdays: ReadonlyArray<string>
    readonly y: number
    readonly m: number
    readonly title: string
    readonly cells: ReadonlyArray<ContentCalendarCell>
    readonly monthItems: ReadonlyArray<PostView>
    readonly isMonthEmpty: boolean
    readonly unscheduled: ReadonlyArray<PostView>
    readonly todayKey: string
    readonly pickedId: string | null
    readonly overKey: string | null
    readonly expandedKey: string | null
    readonly canManage: boolean
    readonly isEmptySetup: boolean
    readonly note: ContentNoteView | null
}
/** Callbacks for calendar interactions, bound by the connected content owner. */
export interface ContentCalendarActions {
    readonly shift: (by: number) => void
    readonly today: () => void
    readonly open: (id: string) => void
    readonly dragStart: (id: string) => void
    readonly pick: (id: string) => void
    readonly dragEnd: () => void
    readonly dragOver: (key: string) => void
    readonly dragLeave: (key: string) => void
    readonly drop: (day: number) => void
    readonly expand: (key: string) => void
    readonly dismissNote: () => void
}
/** Resolved list facts supplied by the connected content owner. */
export interface ContentListFields {
    readonly copy: ContentWorkbenchCopy
    readonly shown: ReadonlyArray<PostView>
    readonly isEmpty: boolean
    readonly filters: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly filter: string
}
/** Callbacks for list interactions, bound by the connected content owner. */
export interface ContentListActions {
    readonly filter: (id: string) => void
    readonly open: (id: string) => void
}
/** Resolved waiting post facts supplied by the connected content owner. */
interface ContentWaitingPost {
    readonly post: PostView
    readonly quotes: ReadonlyArray<QuoteView>
    readonly hasDecision: boolean
}
/** Resolved queue facts supplied by the connected content owner. */
export interface ContentQueueFields {
    readonly copy: ContentWorkbenchCopy
    readonly waiting: ReadonlyArray<ContentWaitingPost>
    readonly ready: ReadonlyArray<PostView>
    readonly canDecide: boolean
    readonly isPending: boolean
    readonly busy: { readonly id: string; readonly decision: "approved" | "rejected" } | null
    readonly notes: Readonly<Record<string, ContentNoteView>>
}
/** Callbacks for queue interactions, bound by the connected content owner. */
export interface ContentQueueActions {
    readonly decide: (id: string, decision: "approved" | "rejected") => void
    readonly open: (id: string) => void
}
/** Existing value, range and descriptive target of one balance meter. */
interface ContentBalanceMeter {
    readonly id: string
    readonly label: string
    readonly value: number
    readonly max: number
    readonly valueLabel: string
    readonly target: string | undefined
}
/** Resolved balance facts supplied by the connected content owner. */
export interface ContentBalanceFields {
    readonly copy: ContentWorkbenchCopy
    readonly y: number
    readonly m: number
    readonly title: string
    readonly monthTitle: string
    readonly themes: ReadonlyArray<ContentBalanceMeter>
    readonly channels: ReadonlyArray<ContentBalanceMeter>
}
/** Callbacks for balance interactions, bound by the connected content owner. */
export interface ContentBalanceActions {
    readonly shift: (by: number) => void
    readonly today: () => void
}
/** Resolved panel facts supplied by the connected content owner. */
interface ContentPanelViews {
    readonly calendar: ContentCalendarFields
    readonly list: ContentListFields
    readonly queue: ContentQueueFields
    readonly balance: ContentBalanceFields
}
/** Callbacks for panel interactions, bound by the connected content owner. */
interface ContentPanelActions {
    readonly calendar: ContentCalendarActions
    readonly list: ContentListActions
    readonly queue: ContentQueueActions
    readonly balance: ContentBalanceActions
}
/** One real board read supplies this unchanged primary ready arrangement. */
export interface ContentWorkbenchPanel {
    readonly canManage: boolean
    readonly copy: ContentWorkbenchCopy
    readonly readOnly: string
    readonly panels: ContentPanelViews
    readonly settings: ContentSettingsViews
    readonly commands: ContentCommandViews
}
/** Plain Base data fields; no world/helper return type or broad native constructor enters the contract. */
export interface ContentWorkbenchFields {
    readonly copy: ContentWorkbenchCopy
    readonly loading: {
        readonly calendar: Pick<ContentCalendarFields, "weekdays" | "y" | "m" | "title" | "todayKey">
        readonly balance: Pick<ContentBalanceFields, "y" | "m" | "monthTitle" | "title">
    }
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: ContentTab
    readonly tabs: ReadonlyArray<{ readonly id: ContentTab; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly panel: {
        readonly slot: DataSlot<ContentWorkbenchPanel>
        readonly labels: SlotLabels
        readonly errorDescription: string
    }
    readonly editor: ContentEditorFields | null
}
/** Callbacks for workbench interactions, bound by the connected content owner. */
export interface ContentWorkbenchActions {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly panels: ContentPanelActions
    readonly settings: ContentSettingsActions
    readonly commands: ContentCommandActions
    readonly editor: ContentEditorActions
}
/** Resolved workbench facts supplied by the connected content owner. */
export interface ContentWorkbenchView {
    readonly shape: ContentWorkbenchShape
    readonly props: ContentWorkbenchFields
    readonly on: ContentWorkbenchActions
}
