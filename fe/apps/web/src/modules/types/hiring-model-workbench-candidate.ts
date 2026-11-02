import type { BadgeTone } from "@starci/grammar/common"
import type { FieldOf } from "./hiring"
import type { SlotPanelProps } from "./slot"
import type { HiringOption } from "./hiring-model-workbench-jobs"
import type { HiringWorkbenchCopy } from "./hiring-model-workbench-copy"
/** Actual coordinated candidate task choices, never read statuses. */
export type HiringCandidateDialog = "interview" | "offer" | "reject" | "delete"
/** Resolved request outcome facts supplied by the connected hiring owner. */
export interface HiringRequestOutcome {
    readonly status: string
    readonly summary: string
}
/** Resolved interview facts supplied by the connected hiring owner. */
interface HiringInterviewValues {
    readonly interviewerUserId: string
    readonly mode: string
    readonly location: string
    readonly durationMin: number
}
/** Resolved offer facts supplied by the connected hiring owner. */
interface HiringOfferValues {
    readonly title: string
    readonly pay: string
    readonly startDate: string
    readonly probation: string
    readonly note: string
}
/** Resolved interview facts supplied by the connected hiring owner. */
export interface HiringInterviewFields {
    readonly copy: HiringWorkbenchCopy
    readonly title: string
    readonly members: ReadonlyArray<HiringOption>
    readonly modes: ReadonlyArray<HiringOption>
    readonly values: HiringInterviewValues
    readonly outcome: HiringRequestOutcome | null
    readonly canSend: boolean
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for interview interactions, bound by the connected hiring owner. */
export interface HiringInterviewActions {
    readonly text: (name: FieldOf<HiringInterviewValues, string>, value: string) => void
    readonly number: (name: FieldOf<HiringInterviewValues, number>, value: number) => void
    readonly send: () => void
    readonly close: () => void
}
/** Resolved offer facts supplied by the connected hiring owner. */
export interface HiringOfferFields {
    readonly copy: HiringWorkbenchCopy
    readonly title: string
    readonly values: HiringOfferValues
    readonly outcome: HiringRequestOutcome | null
    readonly canSend: boolean
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for offer interactions, bound by the connected hiring owner. */
export interface HiringOfferActions {
    readonly text: (name: FieldOf<HiringOfferValues, string>, value: string) => void
    readonly send: () => void
    readonly close: () => void
}
/** Resolved reject facts supplied by the connected hiring owner. */
interface HiringRejectWords {
    readonly title: string
    readonly closeLabel: string
    readonly hint: string
    readonly failed: string
    readonly reasonLabel: string
    readonly kept: string
    readonly cancelLabel: string
    readonly confirmLabel: string
}
/** Resolved reject facts supplied by the connected hiring owner. */
export interface HiringRejectFields {
    readonly copy: HiringRejectWords
    readonly reason: string
    readonly canConfirm: boolean
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for reject interactions, bound by the connected hiring owner. */
export interface HiringRejectActions {
    readonly reason: (value: string) => void
    readonly confirm: () => void
    readonly close: () => void
}
/** Resolved candidate line facts supplied by the connected hiring owner. */
export interface HiringCandidateLine {
    readonly id: string
    readonly title: string
    readonly text: string
}
/** Resolved candidate score facts supplied by the connected hiring owner. */
export interface HiringCandidateScore {
    readonly value: string
    readonly label: string
    readonly tone: BadgeTone
    readonly summary: string | null
    readonly reasons: ReadonlyArray<{
        readonly id: string
        readonly criterion: string
        readonly note: string
        readonly statusLabel: string
        readonly tone: BadgeTone
    }>
}
/** Resolved candidate frame facts supplied by the connected hiring owner. */
export interface HiringCandidateFrameFields {
    readonly copy: HiringWorkbenchCopy
    readonly isOpen: boolean
    readonly name: string
    readonly subtitle: string
    readonly stageLabel: string
    readonly stageTone: BadgeTone
    readonly contacts: ReadonlyArray<string>
    readonly canSchedule: boolean
    readonly canOffer: boolean
    readonly canShortlist: boolean
    readonly canReject: boolean
    readonly score: HiringCandidateScore | null
    readonly answers: ReadonlyArray<HiringCandidateLine>
    readonly interviews: ReadonlyArray<HiringCandidateLine>
    readonly offers: ReadonlyArray<HiringCandidateLine & { readonly canCancel: boolean }>
    readonly notes: string
    readonly canSaveNotes: boolean
    readonly retention: string
    readonly isBusy: boolean
    readonly error: string | null
    readonly notice: string | null
    readonly isDeleteOpen: boolean
    readonly deleteTitle: string
}
/** Callbacks for candidate frame interactions, bound by the connected hiring owner. */
export interface HiringCandidateFrameActions {
    readonly openDialog: (dialog: HiringCandidateDialog) => void
    readonly shortlist: () => void
    readonly rescreen: () => void
    readonly notes: (value: string) => void
    readonly saveNotes: () => void
    readonly cancelOffer: (id: string) => void
    readonly remove: () => Promise<void>
    readonly clear: () => void
    readonly close: () => void
    readonly closeDialog: () => void
}
/** Resolved candidate cv facts supplied by the connected hiring owner. */
interface HiringCandidateCvFields {
    readonly hasCv: boolean
    readonly openLabel: string
    readonly url: string
    readonly isPdf: boolean
    readonly canPreview: boolean
    readonly isPreviewing: boolean
}
/** Resolved candidate dialogs facts supplied by the connected hiring owner. */
interface HiringCandidateDialogs {
    readonly interview: HiringInterviewFields
    readonly offer: HiringOfferFields
    readonly reject: HiringRejectFields
}
/** Callbacks for candidate dialog interactions, bound by the connected hiring owner. */
interface HiringCandidateDialogActions {
    readonly close: () => void
    readonly interview: HiringInterviewActions
    readonly offer: HiringOfferActions
    readonly reject: HiringRejectActions
}
/** Resolved candidate facts supplied by the connected hiring owner. */
export interface HiringCandidateFields {
    readonly frame: HiringCandidateFrameFields
    readonly dialog: HiringCandidateDialog | null
    readonly dialogs: HiringCandidateDialogs
    readonly cv: Pick<SlotPanelProps<HiringCandidateCvFields>, "slot" | "labels">
    readonly hasNoCv: boolean
    readonly history: Pick<SlotPanelProps<ReadonlyArray<HiringCandidateLine>>, "slot" | "labels">
}
/** Callbacks for candidate interactions, bound by the connected hiring owner. */
export interface HiringCandidateActions {
    readonly frame: HiringCandidateFrameActions
    readonly dialogs: HiringCandidateDialogActions
    readonly toggleCv: () => void
    readonly retryDetail: () => void
}
