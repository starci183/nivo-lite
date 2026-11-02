import type { SlotPanelProps } from "./slot"
import type { WorkbenchDashboardRegions, WorkbenchExplanationView, WorkbenchFigureRegion } from "./workbench-dashboard"
import type { HiringJobsFields, HiringJobsActions } from "./hiring-model-workbench-jobs"
import type { HiringCandidateFields, HiringCandidateActions } from "./hiring-model-workbench-candidate"
import type { HiringPipelineFields, HiringPipelineActions } from "./hiring-model-workbench-pipeline"
import type {
    HiringInterviewsFields,
    HiringInterviewsActions,
    HiringOffersFields,
    HiringOffersActions,
    HiringOnboardingFields,
    HiringOnboardingActions,
    HiringSettingsFields,
    HiringSettingsActions,
    HiringAvailabilityFields,
    HiringAvailabilityActions,
} from "./hiring-model-workbench-panels"
/** Original Hiring strip order, independent of any world hook. */
export const HIRING_TABS = ["jobs", "candidates", "interviews", "offers", "onboarding", "settings"] as const
/** Resolved tab facts supplied by the connected hiring owner. */
export type HiringTab = (typeof HIRING_TABS)[number]
/** Resolved workbench facts supplied by the connected hiring owner. */
type HiringWorkbenchShape = HiringTab | "explanation"
/** Resolved board facts supplied by the connected hiring owner. */
interface HiringBoardViews {
    readonly jobs: HiringJobsFields
    readonly pipeline: HiringPipelineFields
    readonly interviews: HiringInterviewsFields
    readonly offers: HiringOffersFields
    readonly onboarding: HiringOnboardingFields
}
/** Callbacks for board interactions, bound by the connected hiring owner. */
interface HiringBoardActions {
    readonly jobs: HiringJobsActions
    readonly pipeline: HiringPipelineActions
    readonly interviews: HiringInterviewsActions
    readonly offers: HiringOffersActions
    readonly onboarding: HiringOnboardingActions
}
/** Resolved settings facts supplied by the connected hiring owner. */
interface HiringSettingsViews {
    readonly settings: HiringSettingsFields
    readonly availability: HiringAvailabilityFields
}
/** Callbacks for settings view interactions, bound by the connected hiring owner. */
interface HiringSettingsViewActions {
    readonly settings: HiringSettingsActions
    readonly availability: HiringAvailabilityActions
}
/** Resolved workbench panel facts supplied by the connected hiring owner. */
export interface HiringWorkbenchPanel {
    readonly panels: HiringBoardViews
    readonly settings: HiringSettingsViews
}
/** Resolved workbench facts supplied by the connected hiring owner. */
export interface HiringWorkbenchFields {
    readonly why: WorkbenchExplanationView
    readonly regions: WorkbenchDashboardRegions
    readonly tabsLabel: string
    readonly selectedTab: HiringTab
    readonly tabs: ReadonlyArray<{ readonly id: HiringTab; readonly label: string }>
    readonly ribbon: WorkbenchFigureRegion
    readonly panel: SlotPanelProps<HiringWorkbenchPanel>
    readonly candidate: HiringCandidateFields
}
/** Callbacks for workbench interactions, bound by the connected hiring owner. */
export interface HiringWorkbenchActions {
    readonly selectTab: (id: string) => void
    readonly closeWhy: () => void
    readonly retryDashboard: () => void
    readonly retry: () => void
    readonly panels: HiringBoardActions
    readonly settings: HiringSettingsViewActions
    readonly candidate: HiringCandidateActions
}
/** Resolved workbench facts supplied by the connected hiring owner. */
export interface HiringWorkbenchView {
    readonly shape: HiringWorkbenchShape
    readonly props: HiringWorkbenchFields
    readonly on: HiringWorkbenchActions
}
