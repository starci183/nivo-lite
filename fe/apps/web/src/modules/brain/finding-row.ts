import type { FindingAction, MemberOption } from "./finding-view"
import type { RowTone } from "./findings"

/** One line of a static list, already worded: a thing a finding rests on, or a place a draft leaves to fill. */
export interface EvidenceItemView {
    readonly id: string
    /** For evidence the quote, else the fact line, else the label; for a place to fill, its name. */
    readonly label: string
    /** What the quote is, or why the place is left; absent when there is nothing to add. */
    readonly description?: string
}

/** A document the evidence comes from, linked. */
export interface EvidenceSourceView {
    readonly id: string
    readonly label: string
    readonly href: string
}

/** One action of a row. An upload is a destination; the rest are commands. */
export interface FindingActionView {
    readonly id: FindingAction
    readonly label: string
    readonly href: string | null
}

/** One finding as a row, already worded. */
export interface FindingRowView {
    readonly id: string
    readonly title: string
    /** Where the title leads (the dossier of the finding); null where the row is not a link. */
    readonly titleHref: string | null
    readonly detail: string
    readonly badges: ReadonlyArray<{ readonly id: string; readonly label: string; readonly tone: RowTone }>
    /** The dossier, the status, the owner, the due date and the note of the decision, as one muted line; null when the row has none. */
    readonly meta: string | null
    /** The finding the address points at. */
    readonly isFocused: boolean
    readonly evidenceTitle: string
    readonly evidence: ReadonlyArray<EvidenceItemView>
    readonly sources: ReadonlyArray<EvidenceSourceView>
    readonly actions: ReadonlyArray<FindingActionView>
}

/** The value of the assignee choice that names nobody. */
export const NO_ASSIGNEE = "none"

/** The actions that open a dialog, and the dialog each opens. */
export type DialogKind = "dismiss" | "done" | "assign" | "draft"

/** The dialog an action opens; the other actions open none. */
export const DIALOG_OF_ACTION: Readonly<Partial<Record<FindingAction, DialogKind>>> = {
    dismiss: "dismiss",
    markDone: "done",
    assign: "assign",
    askDraft: "draft",
}

/** What the person typed or chose in a dialog, as its form hands it over. */
export interface FindingDialogValues {
    /** The reason, the note or the instructions of a dialog that asks for text; empty for the assignment. */
    readonly text: string
    /** The id of the member chosen, or {@link NO_ASSIGNEE}. */
    readonly assigneeId: string
    /** The due date as YYYY-MM-DD, or empty. */
    readonly dueAt: string
}

/** The text field of a dialog that asks for a reason, a note or instructions. */
export interface FindingTextFieldView {
    readonly label: string
    readonly hint: string | undefined
    readonly isRequired: boolean
    readonly minLength: number
    readonly maxLength: number
}

/** The choices of the assignment dialog. */
export interface FindingAssignFieldsView {
    readonly assigneeLabel: string
    readonly unassignedLabel: string
    readonly dueLabel: string
    readonly options: ReadonlyArray<MemberOption>
    /** The member the finding is with now, or {@link NO_ASSIGNEE}. */
    readonly assigneeId: string
    /** The due date it has now as YYYY-MM-DD, or null. */
    readonly dueAt: string | null
}

/** What one dialog says and asks: a text field, or the assignment choices. */
export interface FindingDialogView {
    readonly formId: string
    readonly title: string
    readonly closeLabel: string
    readonly cancelLabel: string
    readonly submitLabel: string
    readonly isPending: boolean
    readonly text: FindingTextFieldView | null
    readonly assign: FindingAssignFieldsView | null
}
