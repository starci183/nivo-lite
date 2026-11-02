import type { ContentChannel } from "./content"
import type { ContentNoteView } from "./content-editor"
/** The switchable automations (they run in the back end). */
export type AutomationKey = "today_reminder" | "offer_draft" | "weekly_summary"
import type { ContentWorkbenchCopy } from "./content-model-workbench-copy"

/** The posting rhythm's actual editable row. */
export interface ContentCadenceRow {
    readonly channel: ContentChannel
    readonly label: string
    readonly on: boolean
    readonly perWeek: number
    readonly days: ReadonlyArray<number>
    readonly time: string
}
/** A saved or unsaved theme, preserving its stable local key. */
export interface ContentPillarRow {
    readonly key: string
    readonly id?: string | undefined
    readonly name: string
    readonly description: string
    readonly weight: number
    readonly active: boolean
}
/** The common resolved facts of the four existing settings forms. */
interface ContentSettingsFields {
    readonly copy: ContentWorkbenchCopy
    readonly canManage: boolean
    readonly isPending: boolean
    readonly note: ContentNoteView | null
}
/** Resolved brand facts supplied by the connected content owner. */
export interface ContentBrandFields extends ContentSettingsFields {
    readonly voice: string
    readonly avoid: string
    readonly cta: string
    readonly tags: string
}
/** Callbacks for brand interactions, bound by the connected content owner. */
export interface ContentBrandActions {
    readonly voice: (value: string) => void
    readonly avoid: (value: string) => void
    readonly cta: (value: string) => void
    readonly tags: (value: string) => void
    readonly save: () => void
    readonly dismissNote: () => void
}
/** Resolved cadence facts supplied by the connected content owner. */
export interface ContentCadenceFields extends ContentSettingsFields {
    readonly rows: ReadonlyArray<ContentCadenceRow>
    readonly dayNames: ReadonlyArray<string>
}
/** Callbacks for cadence interactions, bound by the connected content owner. */
export interface ContentCadenceActions {
    readonly change: (channel: ContentChannel, patch: Partial<ContentCadenceRow>) => void
    readonly preset: () => void
    readonly save: () => void
    readonly dismissNote: () => void
}
/** Resolved pillar facts supplied by the connected content owner. */
export interface ContentPillarFields extends ContentSettingsFields {
    readonly rows: ReadonlyArray<ContentPillarRow>
}
/** Callbacks for pillar interactions, bound by the connected content owner. */
export interface ContentPillarActions {
    readonly change: (key: string, patch: Partial<ContentPillarRow>) => void
    readonly add: () => void
    readonly remove: (key: string) => void
    readonly preset: () => void
    readonly save: () => void
    readonly dismissNote: () => void
}
/** Resolved automation facts supplied by the connected content owner. */
export interface ContentAutomationFields extends ContentSettingsFields {
    readonly rows: ReadonlyArray<{
        readonly key: AutomationKey
        readonly title: string
        readonly body: string
        readonly on: boolean
    }>
}
/** Callbacks for automation interactions, bound by the connected content owner. */
export interface ContentAutomationActions {
    readonly toggle: (key: string, value: boolean) => void
    readonly dismissNote: () => void
}
/** Each settings form retains its independent values and command owner. */
export interface ContentSettingsViews {
    readonly brand: ContentBrandFields
    readonly cadence: ContentCadenceFields
    readonly pillars: ContentPillarFields
    readonly automation: ContentAutomationFields
}
/** Callbacks for settings interactions, bound by the connected content owner. */
export interface ContentSettingsActions {
    readonly brand: ContentBrandActions
    readonly cadence: ContentCadenceActions
    readonly pillars: ContentPillarActions
    readonly automation: ContentAutomationActions
}

/** Facts and actions shared by the actual three command dialogs. */
interface ContentCommandFields {
    readonly copy: ContentWorkbenchCopy
    readonly isOpen: boolean
    readonly isPending: boolean
    readonly note: ContentNoteView | null
}
interface ContentDialogActions {
    readonly open: () => void
    readonly close: () => void
    readonly openChange: (open: boolean) => void
    readonly run: () => void
    readonly dismissNote: () => void
}
/** Resolved add post facts supplied by the connected content owner. */
export interface ContentAddPostFields extends ContentCommandFields {
    readonly title: string
    readonly date: string
    readonly time: string
    readonly pillarId: string | null
    readonly channels: ReadonlyArray<ContentChannel>
    readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
    readonly pillarOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
}
/** Callbacks for add post interactions, bound by the connected content owner. */
export interface ContentAddPostActions extends ContentDialogActions {
    readonly title: (value: string) => void
    readonly date: (value: string) => void
    readonly time: (value: string) => void
    readonly pillar: (id: string | null) => void
    readonly channels: (values: ReadonlyArray<string>) => void
}
/** Resolved quick idea facts supplied by the connected content owner. */
export interface ContentQuickIdeaFields extends ContentCommandFields {
    readonly topic: string
    readonly channels: ReadonlyArray<ContentChannel>
    readonly channelOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
}
/** Callbacks for quick idea interactions, bound by the connected content owner. */
export interface ContentQuickIdeaActions extends ContentDialogActions {
    readonly topic: (value: string) => void
    readonly channels: (values: ReadonlyArray<string>) => void
}
/** Resolved plan facts supplied by the connected content owner. */
export interface ContentPlanFields extends ContentCommandFields {
    readonly months: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly month: string
    readonly lastPlan: string | null
}
/** Callbacks for plan interactions, bound by the connected content owner. */
export interface ContentPlanActions extends ContentDialogActions {
    readonly month: (id: string) => void
}
/** Resolved command facts supplied by the connected content owner. */
export interface ContentCommandViews {
    readonly plan: ContentPlanFields
    readonly quick: ContentQuickIdeaFields
    readonly add: ContentAddPostFields
}
/** Callbacks for command interactions, bound by the connected content owner. */
export interface ContentCommandActions {
    readonly plan: ContentPlanActions
    readonly quick: ContentQuickIdeaActions
    readonly add: ContentAddPostActions
}
