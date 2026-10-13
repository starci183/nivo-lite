import type {
    HiringAnswerType,
    HiringCvType,
    HiringEventType,
    HiringFiguresType,
    HiringOnboardingType,
    HiringScoreReasonType,
    HiringSettingsType,
    HiringSlotType,
    HiringWindowType,
} from "@/modules/api"

/** The requirements a job screens candidates on. */
export interface RequirementsView {
    readonly skills: ReadonlyArray<string>
    readonly experienceYears: number | null
    readonly experienceNote: string
    readonly availability: ReadonlyArray<string>
    readonly mustHave: ReadonlyArray<string>
    readonly niceToHave: ReadonlyArray<string>
}

/** One question a job asks its candidates. */
export interface JobQuestionView {
    readonly id: string
    readonly text: string
    readonly type: string
    readonly required: boolean
    readonly choices: ReadonlyArray<string>
    readonly expectYesNo: string | null
    readonly expectNumber: number | null
    readonly expectChoices: ReadonlyArray<string>
}

/** The three ready-to-paste variants of a job ad. */
export interface AdView {
    readonly facebook: string
    readonly zalo: string
    readonly topcv: string
}

/** One job post. */
export interface JobView {
    readonly id: string
    readonly title: string
    readonly position: string
    readonly employmentType: string
    readonly schedule: string
    readonly payMinVnd: number | null
    readonly payMaxVnd: number | null
    readonly payUnit: string
    readonly location: string
    readonly headcount: number
    readonly description: string
    readonly requirements: RequirementsView
    readonly questions: ReadonlyArray<JobQuestionView>
    readonly status: string
    readonly channels: ReadonlyArray<string>
    readonly ad: AdView | null
    readonly publicUrl: string | null
}

/** One candidate. */
export interface CandidateView {
    readonly id: string
    readonly jobId: string
    readonly name: string
    readonly phone: string
    readonly email: string
    readonly source: string
    readonly cvPath: string | null
    readonly answers: ReadonlyArray<HiringAnswerType>
    readonly availability: string
    readonly score: number | null
    readonly scoreLabel: string | null
    readonly scoreReasons: ReadonlyArray<HiringScoreReasonType>
    readonly scoreSummary: string | null
    readonly stage: string
    readonly notes: string
    readonly staffId: string | null
    readonly createdAt: string
}

/** One interview. */
export interface InterviewView {
    readonly id: string
    readonly candidateId: string
    readonly jobId: string
    readonly interviewerName: string
    readonly mode: string
    readonly location: string
    readonly slots: ReadonlyArray<HiringSlotType>
    readonly slotStart: string | null
    readonly status: string
    readonly token: string
    readonly note: string
    readonly workItemId: string | null
}

/** One offer. */
export interface OfferView {
    readonly id: string
    readonly candidateId: string
    readonly jobId: string
    readonly pay: string
    readonly startDate: string
    readonly status: string
    readonly token: string
    readonly sentAt: string | null
    readonly sentVia: string | null
    readonly expiresAt: string | null
    readonly workItemId: string | null
}

/** One member who can interview, with the windows they are free in. */
export interface HiringMemberView {
    readonly userId: string
    readonly name: string
    readonly windows: ReadonlyArray<HiringWindowType>
}

/** The whole Hiring workbench a manager sees. */
export interface HiringWorkbenchData {
    readonly nowIso: string
    readonly origin: string
    readonly meUserId: string
    readonly waitingApprovals: number
    readonly settings: HiringSettingsType
    readonly figures: HiringFiguresType
    readonly jobs: ReadonlyArray<JobView>
    readonly candidates: ReadonlyArray<CandidateView>
    readonly interviews: ReadonlyArray<InterviewView>
    readonly offers: ReadonlyArray<OfferView>
    readonly onboarding: ReadonlyArray<HiringOnboardingType>
    readonly members: ReadonlyArray<HiringMemberView>
}

/** What the candidate drawer reads on top of the workbench: the CV link and the timeline. */
export interface CandidateDetailView {
    readonly cv: HiringCvType | null
    readonly events: ReadonlyArray<HiringEventType>
}
