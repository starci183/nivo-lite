import type { BadgeTone } from "@starci/grammar/common"
import type { ModuleIconName } from "./module-icon"
import type { DateValue } from "@internationalized/date"
import type { FlowView, LeadIcon, LeadStepMode, StepFormView } from "./leads"
import type { DataSlot, SlotLabels } from "./slot"

/** One lead of the list pane, every word already resolved. */
export interface LeadRowView {
    readonly id: string
    readonly name: string
    readonly company: string
    /** Where it came from and when: the company, the channel and the age, as one line. */
    readonly line: string
    /** Who owns it, or the words that nobody does yet. */
    readonly owner: string
    readonly badge: { readonly label: string; readonly tone: BadgeTone }
}

/** What the list pane shows: the stage choices with their counts and the rows the filters let through. */
export interface LeadListView {
    readonly tabs: ReadonlyArray<{ readonly value: string; readonly label: string; readonly count?: number }>
    readonly rows: ReadonlyArray<LeadRowView>
    /** True when the workspace has any lead at all, so an empty list means "nothing matched" rather than "first run". */
    readonly hasLeads: boolean
    readonly isFiltered: boolean
}

/** The fields of the new-lead dialog. */
export interface LeadFormValues {
    readonly contact_name: string
    readonly company: string
    readonly channel: string
    readonly need: string
}

/** The words and state of the new-lead dialog. */
export interface LeadCreateDialogProps {
    readonly props: {
        readonly isOpen: boolean
        readonly title: string
        readonly intro: string
        readonly closeLabel: string
        readonly contactLabel: string
        readonly contactHint: string
        readonly companyLabel: string
        readonly companyHint: string
        readonly channelLabel: string
        readonly channelHint: string
        readonly channelPlaceholder: string
        readonly channelOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly afterNote: string
        readonly needLabel: string
        readonly needHint: string
        readonly cancelLabel: string
        readonly submitLabel: string
        readonly pendingText: string
        readonly failTitle: string
        readonly values: LeadFormValues
        readonly errors: Partial<Record<keyof LeadFormValues, string>>
        readonly submitError: string | null
        readonly isPending: boolean
    }
    readonly on: {
        readonly change: (field: keyof LeadFormValues, value: string) => void
        readonly submit: () => void
        readonly close: () => void
    }
}

/** What the head band says about one lead, already worded. */
export interface LeadHeadView {
    readonly name: string
    readonly meta: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
}

/** The words of the head band, its menu and its aside opener. */
export interface LeadHeadLabels {
    readonly draft: string
    readonly office: string
    readonly officeHref: string
    readonly moreActions: string
    readonly infoOpen: string
    readonly infoClose: string
    readonly menuRefresh: string
    readonly menuOutcome: string
    readonly menuReassign: string
    readonly menuDue: string
    readonly menuCopy: string
    readonly menuCopyBrief: string
    readonly fallbackTitle: string
}

/** The head band's state: the lead (or why there is none), the one primary command and the notice of the last command. */
export interface LeadHeadPane {
    readonly slot: DataSlot<LeadHeadView>
    readonly primary: "draft" | "none"
    readonly responsibilityId: string | null
    readonly notice: string | null
    readonly isPending: boolean
    readonly canOpenStepMenu: boolean
}

/** The drafting agent: its mark and its spoken name. */
export interface LeadApprovalAgent {
    readonly name: string
    readonly glyph: ModuleIconName
    readonly avatarUrl: string | null
}

/** One drafted message with every word resolved and the state of its controls. */
export interface LeadApprovalCardView {
    readonly nextAction: string
    readonly willSend: string
    readonly agent: LeadApprovalAgent | null
    readonly status: { readonly label: string; readonly tone: BadgeTone }
    readonly draft: string
    readonly characters: string
    readonly settledLabel: string
    readonly isWaiting: boolean
    readonly canDecide: boolean
    readonly isEditing: boolean
    readonly editText: string
    readonly pendingDecision: "approved" | "rejected" | null
    readonly error: string | null
}

/** The words of an approval card. */
export interface LeadApprovalCardLabels {
    readonly note: string
    readonly draft: string
    readonly copy: string
    readonly copied: string
    readonly waitingManager: string
    readonly approveSend: string
    readonly edit: string
    readonly discardEdits: string
    readonly reject: string
}

/** One draft with what its approval card says about it. */
export interface LeadDraftItem {
    readonly id: string
    readonly view: LeadApprovalCardView
}

/** What the main pane shows about the drafts of one lead. */
export interface LeadApprovalView {
    readonly explanation: string
    readonly canDraft: boolean
    readonly waiting: LeadDraftItem | null
    readonly earlier: ReadonlyArray<LeadDraftItem>
}

/** The approval region: its read, its words and the state of the last command. */
export interface LeadApprovalPane {
    readonly slot: DataSlot<LeadApprovalView>
    readonly labels: {
        readonly waitingTitle: string
        readonly followUp: string
        readonly failTitle: string
        readonly earlierTitle: string
        readonly earlierMeta: string
        readonly slot: SlotLabels
        readonly approval: LeadApprovalCardLabels
    }
    readonly error: string | null
    readonly isPending: boolean
}

/** One line of the activity trail, already resolved to text. */
export interface LeadTimelineEntryView {
    readonly id: string
    readonly dateTime: string
    readonly timeLabel: string
    readonly icon: LeadIcon
    readonly title: string
    readonly summary: string
    readonly evidence: string | null
    readonly isOpen: boolean
}

/** The activity trail of one lead: events and earlier steps in one order. */
export interface LeadTimelineView {
    readonly meta: string
    readonly entries: ReadonlyArray<LeadTimelineEntryView>
}

/** The step being worked on, every word already resolved. */
export interface LeadStepView {
    readonly title: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly nextAction: string
    readonly ownerName: string
    readonly ownerKindText: string
    readonly due: { readonly date: string; readonly relative: string; readonly isOverdue: boolean } | null
    readonly isDone: boolean
    readonly isAgent: boolean
    readonly agentGlyph: ModuleIconName
    readonly agentAvatarUrl: string | null
}

/** What the aside shows about the next step: the current step, or none yet. */
export interface LeadStepSectionView {
    readonly current: LeadStepView | null
}

/** What the aside shows about the customer context, all of it formatted. */
export interface LeadContextView {
    readonly contact: string
    readonly company: string
    readonly channel: string
    readonly captured: string
    readonly need: string
    readonly hasBrief: boolean
    readonly briefLines: ReadonlyArray<string>
    readonly preparedBy: string
    readonly signals: ReadonlyArray<{ readonly id: string; readonly label: string }>
    readonly hasConversation: boolean
}

/** One recorded piece of evidence, already resolved to text. */
export interface LeadEvidenceView {
    readonly id: string
    readonly byline: string
    readonly text: string
}

/** What the aside shows about where the journey stands. */
export interface LeadOutcomeView {
    readonly steps: ReadonlyArray<{ readonly id: string; readonly label: string; readonly state?: "error" }>
    readonly currentStepId: string
    readonly evidenceNote: string
    readonly stage: string
    readonly wonNote: string | null
    readonly recorded: ReadonlyArray<LeadEvidenceView>
}

/** The words of the step dialog. */
export interface LeadStepFormLabels {
    readonly title: string
    readonly owner: string
    readonly nextStep: string
    readonly due: string
    readonly saveFailTitle: string
    readonly cancel: string
    readonly closeLabel: string
}

/** The next-step region of the aside and the dialog that edits it. */
export interface LeadStepPane {
    readonly slot: DataSlot<LeadStepSectionView>
    readonly form: StepFormView | null
    readonly proposeError: string | null
    readonly isPending: boolean
    readonly labels: {
        readonly title: string
        readonly nextStepLabel: string
        readonly dueLabel: string
        readonly noDueLabel: string
        readonly overdueLabel: string
        readonly noOwnerTitle: string
        readonly noOwnerHint: string
        readonly proposeLabel: string
        readonly proposeFailTitle: string
        readonly menuLabel: string
        readonly reassignLabel: string
        readonly changeDueLabel: string
        readonly askLabel: string
        readonly askHref: string
        readonly addLabel: string
        readonly form: LeadStepFormLabels
        readonly slot: SlotLabels
    }
}

/** The context region of the aside. */
export interface LeadContextPane {
    readonly slot: DataSlot<LeadContextView>
    readonly error: string | null
    readonly isPending: boolean
    readonly labels: {
        readonly title: string
        readonly factContact: string
        readonly factCompany: string
        readonly factChannel: string
        readonly factCaptured: string
        readonly customerWords: string
        readonly quoteSource: string
        readonly viewConversation: string
        readonly conversationHref: string
        readonly noBriefTitle: string
        readonly noBriefHint: string
        readonly prepare: string
        readonly errorTitle: string
        readonly slot: SlotLabels
    }
}

/** The outcome region of the aside and the dialog that records one. */
export interface LeadOutcomePane {
    readonly slot: DataSlot<LeadOutcomeView>
    readonly evidenceText: string
    readonly isDialogOpen: boolean
    readonly error: string | null
    readonly isPending: boolean
    readonly labels: {
        readonly title: string
        readonly stepperLabel: string
        readonly evidenceLead: string
        readonly recordLabel: string
        readonly stageLabel: string
        readonly stageOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
        readonly evidenceLabel: string
        readonly evidenceHint: string
        readonly cancel: string
        readonly failTitle: string
        readonly recordedTitle: string
        readonly slot: SlotLabels
    }
}

/** The orders-and-payments region of the aside, one row per kind. */
export interface LeadFlowPane {
    readonly slot: DataSlot<FlowView>
    readonly labels: { readonly title: string; readonly stepsTitle: string; readonly slot: SlotLabels }
}

/** The activity trail region: its read and its words. */
export interface LeadTimelinePane {
    readonly slot: DataSlot<LeadTimelineView>
    readonly labels: {
        readonly title: string
        readonly timelineLabel: string
        readonly emptyHint: string
        readonly auditNote: string
        readonly evidenceLabel: string
        readonly slot: SlotLabels
    }
}

/** Everything the panes of one open lead draw; the aside is hidden or shown by `isInfoOpen`. */
export interface LeadDetailPaneView {
    /** Some region of the page is still on its first read: every region shows its skeleton together. */
    readonly isLoading: boolean
    readonly head: LeadHeadPane
    readonly headLabels: LeadHeadLabels
    readonly approval: LeadApprovalPane
    readonly timeline: LeadTimelinePane
    readonly step: LeadStepPane
    readonly context: LeadContextPane
    readonly hasBrief: boolean
    readonly outcome: LeadOutcomePane
    readonly flow: LeadFlowPane
    readonly isInfoOpen: boolean
    readonly isDrawerOpen: boolean
    readonly copy: {
        readonly infoTitle: string
        readonly infoClose: string
        readonly flowNone: string
        readonly noticeTitle: string
    }
}

/** The commands of the panes of one open lead, one flat set: each region's commands carry its name. */
export interface LeadDetailPaneOn {
    readonly draft: (responsibilityId: string) => void
    readonly refresh: () => void
    readonly copy: () => void
    readonly copyBrief: () => void
    readonly toggleInfo: () => void
    readonly drawer: (isOpen: boolean) => void
    readonly approvalToggleEdit: () => void
    readonly approvalEditChange: (value: string) => void
    readonly approvalDecide: (decision: "approved" | "rejected") => void
    readonly timelineRetry: () => void
    readonly timelineToggle: (entryId: string, isOpen: boolean) => void
    readonly stepPropose: () => void
    readonly stepOpen: (mode: LeadStepMode) => void
    readonly stepClose: () => void
    readonly stepChange: (field: "title" | "owner" | "nextAction", value: string) => void
    readonly stepChangeDue: (value: DateValue | null) => void
    readonly stepSubmit: () => void
    readonly contextRefresh: () => void
    readonly outcomeOpen: () => void
    readonly outcomeClose: () => void
    readonly outcomeStage: (value: string) => void
    readonly outcomeEvidence: (value: string) => void
    readonly outcomeSubmit: () => void
    readonly flowRetry: () => void
}

/** The commands of the lead panes: the list, the new-lead dialog and the open lead. */
export interface LeadPanesOn extends LeadDetailPaneOn {
    readonly open: (leadId: string) => void
    readonly back: () => void
    readonly newLead: () => void
    readonly query: (value: string) => void
    readonly stage: (key: string) => void
    readonly clear: () => void
    readonly loadMore: () => void
    readonly retry: () => void
    readonly createChange: (field: keyof LeadFormValues, value: string) => void
    readonly createSubmit: () => void
    readonly createClose: () => void
}

/** What the list pane draws and which lead it marks as open. */
export interface LeadListPaneView {
    readonly slot: DataSlot<LeadListView>
    /** One resting list of the shape of the ready one: the skeleton is this tree drawn with `isLoading`. */
    readonly placeholder: LeadListView
    readonly labels: SlotLabels
    readonly query: string
    readonly stage: string
    readonly selectedId: string | null
    readonly pagination: {
        readonly hasNextPage: boolean
        readonly isPending: boolean
        readonly loadMoreError: string | null
        readonly loadedHint: string | null
    }
}

/** The words of the lead panes. */
export interface LeadPanesCopy {
    readonly grid: string
    readonly title: string
    readonly pageBody: string
    readonly listLabel: string
    readonly detailLabel: string
    readonly pickTitle: string
    readonly pickBody: string
    readonly missingTitle: string
    readonly missingBody: string
    readonly missingBack: string
    readonly newLead: string
    readonly back: string
    readonly searchLabel: string
    readonly searchPlaceholder: string
    readonly clearSearch: string
    readonly tabsLabel: string
    readonly noMatchTitle: string
    readonly noMatchBody: string
    readonly clearFilters: string
    readonly emptyBody: string
    readonly errorBody: string
    readonly loadMore: string
    readonly retry: string
}
