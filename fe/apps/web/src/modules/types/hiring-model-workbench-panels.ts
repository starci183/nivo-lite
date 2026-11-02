import type { BadgeTone } from "@starci/grammar/common"
import type { FieldOf } from "./hiring"
import type { HiringOption } from "./hiring-model-workbench-jobs"
import type { HiringWorkbenchCopy } from "./hiring-model-workbench-copy"
interface HiringPanelFeedback {
    readonly copy: HiringWorkbenchCopy
    readonly isBusy: boolean
    readonly error: string | null
}
/** Resolved interview row facts supplied by the connected hiring owner. */
interface HiringInterviewRow {
    readonly id: string
    readonly candidateId: string
    readonly isConfirmed: boolean
    readonly title: string
    readonly meta: string
}
/** Resolved invitation row facts supplied by the connected hiring owner. */
interface HiringInvitationRow extends HiringInterviewRow {
    readonly badge: string
    readonly proposed: string
    readonly note: string | null
    readonly copyLabel: string
}
/** Resolved interviews facts supplied by the connected hiring owner. */
export interface HiringInterviewsFields extends HiringPanelFeedback {
    readonly weekLabel: string
    readonly isThisWeek: boolean
    readonly days: ReadonlyArray<{
        readonly key: string
        readonly label: string
        readonly isToday: boolean
        readonly items: ReadonlyArray<HiringInterviewRow>
    }>
    readonly invitations: ReadonlyArray<HiringInvitationRow>
    readonly invitationsFact: string
}
/** Callbacks for interviews interactions, bound by the connected hiring owner. */
export interface HiringInterviewsActions {
    readonly previousWeek: () => void
    readonly nextWeek: () => void
    readonly thisWeek: () => void
    readonly open: (candidateId: string) => void
    readonly status: (id: string, status: string) => void
    readonly copy: (id: string) => void
    readonly clearError: () => void
}
/** Resolved offer row facts supplied by the connected hiring owner. */
interface HiringOfferRow {
    readonly id: string
    readonly candidateId: string
    readonly name: string
    readonly statusLabel: string
    readonly statusTone: BadgeTone
    readonly meta: string
    readonly sent: string | null
    readonly isWaiting: boolean
    readonly copyLabel: string | null
    readonly canCancel: boolean
}
/** Resolved offers facts supplied by the connected hiring owner. */
export interface HiringOffersFields extends HiringPanelFeedback {
    readonly approveLabel: string | null
    readonly decisionsHref: string
    readonly fact: string
    readonly rows: ReadonlyArray<HiringOfferRow>
}
/** Callbacks for offers interactions, bound by the connected hiring owner. */
export interface HiringOffersActions {
    readonly open: (candidateId: string) => void
    readonly copy: (id: string) => void
    readonly cancel: (id: string) => void
    readonly clearError: () => void
}
/** Resolved onboarding facts supplied by the connected hiring owner. */
interface HiringOnboardingWords {
    readonly title: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly errorTitle: string
    readonly dismissLabel: string
    readonly hasStaffLabel: string
    readonly createStaffLabel: string
    readonly progressLabel: string
}
/** Resolved onboarding facts supplied by the connected hiring owner. */
export interface HiringOnboardingFields {
    readonly copy: HiringOnboardingWords
    readonly people: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly job: string
        readonly contact: string
        readonly hasStaff: boolean
        readonly done: number
        readonly steps: ReadonlyArray<{ readonly id: string; readonly title: string; readonly isDone: boolean }>
    }>
    readonly isBusy: boolean
    readonly error: string | null
}
/** Callbacks for onboarding interactions, bound by the connected hiring owner. */
export interface HiringOnboardingActions {
    readonly toggle: (id: string, done: boolean) => void
    readonly linkStaff: (candidateId: string) => void
    readonly clearError: () => void
}
/** Readonly settings snapshot, independent of the private mutable RHF controller. */
interface HiringSettingsValues {
    readonly publicSlug: string
    readonly retentionDays: number
    readonly applyConsentText: string
    readonly adTone: string
    readonly notifyNewCandidate: boolean
    readonly remindInterview: boolean
    readonly autoCloseWhenFilled: boolean
}
/** Resolved settings facts supplied by the connected hiring owner. */
export interface HiringSettingsFields extends HiringPanelFeedback {
    readonly slugHint: string
    readonly values: HiringSettingsValues
    readonly retentionMin: number
    readonly retentionMax: number
    readonly notice: string | null
}
/** Callbacks for settings interactions, bound by the connected hiring owner. */
export interface HiringSettingsActions {
    readonly text: (name: FieldOf<HiringSettingsValues, string>, value: string) => void
    readonly number: (name: FieldOf<HiringSettingsValues, number>, value: number) => void
    readonly flag: (name: FieldOf<HiringSettingsValues, boolean>, value: boolean) => void
    readonly save: () => void
}
/** Resolved availability facts supplied by the connected hiring owner. */
export interface HiringAvailabilityFields extends HiringPanelFeedback {
    readonly members: ReadonlyArray<HiringOption>
    readonly who: string
    readonly days: ReadonlyArray<{
        readonly weekday: number
        readonly label: string
        readonly text: string
        readonly isInvalid: boolean
    }>
    readonly canSave: boolean
    readonly notice: string | null
}
/** Callbacks for availability interactions, bound by the connected hiring owner. */
export interface HiringAvailabilityActions {
    readonly member: (id: string) => void
    readonly text: (weekday: number, text: string) => void
    readonly save: () => void
}
