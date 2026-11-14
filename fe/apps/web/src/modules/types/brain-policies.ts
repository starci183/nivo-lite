import type { BrainPageHeaderView } from "./brain-page"
import type { DataSlot, SlotLabels } from "./slot"

/** The kind of value a shop rule holds, inferred by the back end from the value alone: it picks the drawer's control. */
export type PolicyValueKind = "money" | "percent" | "duration" | "time_range" | "boolean" | "text"

/** The unit a duration is typed in; the back end always receives minutes. */
export type PolicyDurationUnit = "minutes" | "hours" | "days"

/** When a new value takes effect: now, or from the start of a chosen day. */
export type PolicyEffective = "now" | "from"

/** One rule in force as a row: its name, the 12 muted line (source, date, who reads), the value at the end and what waits on it. */
export interface PolicyRowView {
    /** The fact id of the truth: the row's key and the drawer's address. */
    readonly id: string
    readonly name: string
    readonly line: string
    readonly value: string
    /** "from 01/12: 07:00–21:00" when a later value is scheduled; null otherwise. */
    readonly scheduled: string | null
    /** "1 proposed" when proposals wait; null otherwise. */
    readonly pending: string | null
    /** The truth has no value in force (not set): its command reads "set" instead of "edit". */
    readonly isUnset: boolean
}

/** The rules of one group the AI derived, under the group's label. */
export interface PolicyGroupView {
    readonly id: string
    readonly label: string
    readonly rows: ReadonlyArray<PolicyRowView>
}

/** The words of the policies tab. */
export interface PoliciesCopy {
    readonly listLabel: string
    readonly edit: string
    readonly set: string
    readonly emptyBody: string
    readonly emptyAction: string
    readonly errorBody: string
    readonly retry: string
    readonly deriveAction: string
}

/** What the derive pass says above the rows: it runs (no command), or it failed (try again). */
export interface PolicyNoticeView {
    readonly kind: "deriving" | "failed"
    readonly title: string
    readonly body: string
}

/** The words of a shop whose policies the AI has not derived yet: what the AI will read. */
export interface PolicyNotDerivedView {
    readonly title: string
    readonly body: string
}

/**
 * What the policies tab shows: the groups as the one slot of its read (the data status is the slot's alone), what the derive pass
 * says (a notice above the rows, or the first-pass offer of a shop not derived yet), and whether the viewer (the owner) may edit.
 */
export interface PoliciesView {
    readonly slot: DataSlot<ReadonlyArray<PolicyGroupView>>
    /** The groups the loading tab draws: the shape of a loaded tab with no words. */
    readonly placeholder: ReadonlyArray<PolicyGroupView>
    readonly slotLabels: SlotLabels
    readonly notice: PolicyNoticeView | null
    /** Set only when the read answered that no pass ever ran and no rule exists; null otherwise. */
    readonly notDerived: PolicyNotDerivedView | null
    /** A derive pass was just asked for and its answer has not come back. */
    readonly isDerivePending: boolean
    readonly canEdit: boolean
    readonly copy: PoliciesCopy
}

/** The typed value the drawer edits; each control reads the field of its kind. */
export interface PolicyFormView {
    readonly text: string
    readonly amount: number | null
    readonly percent: number | null
    readonly duration: number | null
    readonly durationUnit: PolicyDurationUnit
    readonly from: string
    readonly to: string
    readonly yes: boolean
    readonly customers: boolean
    readonly effective: PolicyEffective
    /** The day a scheduled value starts, `yyyy-mm-dd`. */
    readonly date: string
}

/** One waiting proposal in the drawer: its value, who proposed it from where and when, and its two decisions. */
export interface PolicyProposalView {
    readonly id: string
    readonly value: string
    readonly line: string
    readonly isPending: boolean
}

/** One version in the drawer's history. */
export interface PolicyHistoryView {
    readonly id: string
    readonly title: string
    readonly line: string
}

/** The words of the drawer. */
export interface PolicyDrawerCopy {
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly saveLabel: string
    readonly valueLabel: string
    readonly yes: string
    readonly no: string
    readonly fromTime: string
    readonly toTime: string
    readonly durationUnit: string
    readonly unitOptions: ReadonlyArray<{ readonly id: PolicyDurationUnit; readonly label: string }>
    readonly audienceLabel: string
    readonly customersLabel: string
    readonly customersHint: string
    readonly effectiveLabel: string
    readonly effectiveOptions: ReadonlyArray<{ readonly id: PolicyEffective; readonly label: string }>
    readonly fromDateLabel: string
    readonly proposalsLabel: string
    readonly use: string
    readonly reject: string
    readonly historyLabel: string
    readonly historyEmpty: string
    readonly failTitle: string
    readonly loadFailed: string
}

/** The drawer that edits one rule (a short form): resolved values and words. */
export interface PolicyDrawerProps {
    readonly isOpen: boolean
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly isPending: boolean
    readonly title: string
    /** The AI's one sentence why this is a rule of the shop, under the title; undefined when it gave none. */
    readonly reason: string | undefined
    readonly kind: PolicyValueKind
    /** The per-unit words a money value keeps ("per order"), shown under the amount. */
    readonly per: string | null
    /** Who reads the value today, in words ("every agent reads"). */
    readonly readers: string
    readonly form: PolicyFormView
    readonly proposals: ReadonlyArray<PolicyProposalView>
    readonly history: ReadonlyArray<PolicyHistoryView>
    readonly error: string | undefined
    readonly copy: PolicyDrawerCopy
}

/** What the drawer does. */
export interface PolicyDrawerCommands {
    readonly close: () => void
    readonly submit: () => void
    readonly patch: (change: Partial<PolicyFormView>) => void
    readonly use: (proposalId: string) => void
    readonly reject: (proposalId: string) => void
}

/** The drawer as its block draws it. */
export interface PolicyDrawerView {
    readonly props: PolicyDrawerProps
    readonly on: PolicyDrawerCommands
}

/** Everything the policies block draws. */
export interface BrainPoliciesPageView {
    readonly header: BrainPageHeaderView
    readonly view: PoliciesView
    readonly drawer: PolicyDrawerView
}
