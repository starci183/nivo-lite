import type {
    HiringWorkbenchFields,
    HiringWorkbenchActions,
    HiringWorkbenchPanel,
    HiringTab,
    HiringWorkbenchView,
} from "./hiring-model-workbench"
import type { HiringWorkbenchCopy } from "./hiring-model-workbench-copy"
import type {
    HiringQuestionData,
    HiringJobFormValues,
    HiringAdData,
    HiringJobAdFields,
    HiringJobAdActions,
    HiringJobEditorFields,
    HiringJobEditorActions,
    HiringJobRow,
    HiringJobsFields,
    HiringJobListActions,
} from "./hiring-model-workbench-jobs"
import type {
    HiringAvailabilityFields,
    HiringAvailabilityActions,
    HiringInterviewsFields,
    HiringInterviewsActions,
    HiringOffersFields,
    HiringOffersActions,
    HiringOnboardingFields,
    HiringOnboardingActions,
    HiringSettingsFields,
    HiringSettingsActions,
} from "./hiring-model-workbench-panels"
import type {
    HiringCandidateLine,
    HiringCandidateDialog,
    HiringInterviewFields,
    HiringInterviewActions,
    HiringOfferFields,
    HiringOfferActions,
    HiringRejectFields,
    HiringRejectActions,
    HiringCandidateScore,
    HiringCandidateFrameFields,
    HiringCandidateFrameActions,
    HiringRequestOutcome,
} from "./hiring-model-workbench-candidate"
import type {
    HiringPipelineCard,
    HiringPipelineFields,
    HiringPipelineBoardActions,
} from "./hiring-model-workbench-pipeline"

/** Resolved read facts and words for the Hiring workbench. */
export interface HiringViews {
    readonly workbenchFields: HiringWorkbenchFields
    readonly workbenchPanel: HiringWorkbenchPanel
    readonly workbenchCopy: HiringWorkbenchCopy
    readonly questionData: HiringQuestionData
    readonly jobFormValues: HiringJobFormValues
    readonly availabilityFields: HiringAvailabilityFields
    readonly candidateLine: HiringCandidateLine
    readonly candidateDialog: HiringCandidateDialog
    readonly interviewFields: HiringInterviewFields
    readonly interviewsFields: HiringInterviewsFields
    readonly adData: HiringAdData
    readonly jobAdFields: HiringJobAdFields
    readonly jobEditorFields: HiringJobEditorFields
    readonly jobRow: HiringJobRow
    readonly jobsFields: HiringJobsFields
    readonly offerFields: HiringOfferFields
    readonly offersFields: HiringOffersFields
    readonly onboardingFields: HiringOnboardingFields
    readonly pipelineCard: HiringPipelineCard
    readonly pipelineFields: HiringPipelineFields
    readonly rejectFields: HiringRejectFields
    readonly candidateScore: HiringCandidateScore
    readonly settingsFields: HiringSettingsFields
    readonly candidateFrameFields: HiringCandidateFrameFields
    readonly requestOutcome: HiringRequestOutcome
    readonly tab: HiringTab
}

/** Atomic commands owned by the connected world for the Hiring workbench. */
export interface HiringActions {
    readonly workbenchActions: HiringWorkbenchActions
    readonly availabilityActions: HiringAvailabilityActions
    readonly interviewActions: HiringInterviewActions
    readonly interviewsActions: HiringInterviewsActions
    readonly jobAdActions: HiringJobAdActions
    readonly jobEditorActions: HiringJobEditorActions
    readonly jobListActions: HiringJobListActions
    readonly offerActions: HiringOfferActions
    readonly offersActions: HiringOffersActions
    readonly onboardingActions: HiringOnboardingActions
    readonly pipelineBoardActions: HiringPipelineBoardActions
    readonly rejectActions: HiringRejectActions
    readonly settingsActions: HiringSettingsActions
    readonly candidateFrameActions: HiringCandidateFrameActions
}

/** The connected world assembly for the Hiring workbench. */
export interface HiringAssembly {
    readonly workbenchView: HiringWorkbenchView
}
