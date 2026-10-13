import type {
    CandidateRecord,
    HiringSettings,
    InterviewRecord,
    JobRecord,
    OfferRecord,
    ScoreLabel,
    ScoreReason,
} from "./hiring.contracts"

/** The hiring figures of the ribbon. */
export interface HiringFiguresView {
    /** Jobs open now. */
    readonly openRoles: number
    /** All jobs. */
    readonly totalRoles: number
    /** Candidates still moving through the pipeline. */
    readonly pipeline: number
    /** Confirmed interviews this week, Vietnam calendar. */
    readonly interviewsWeek: number
    /** Offers waiting for the manager's approval. */
    readonly offersWaiting: number
    /** Offers sent, waiting for the candidate. */
    readonly offersSent: number
}

/** One job of the workbench, with its generated ads and its public link. */
export interface HiringJobView extends JobRecord {
    /** The generated ad texts, when made. */
    readonly adVariants: Record<string, unknown> | null
    /** When the job was created. */
    readonly createdAt: string
    /** When the job was last edited. */
    readonly updatedAt: string
    /** The public link, or null while the workspace has no public slug. */
    readonly publicUrl: string | null
}

/** One candidate of the workbench, with the screening and notes. */
export interface HiringCandidateView extends CandidateRecord {
    /** The CV file size in bytes. */
    readonly cvSize: number | null
    /** The screening score, 0 to 100. */
    readonly score: number | null
    /** The screening verdict. */
    readonly scoreLabel: ScoreLabel | null
    /** The screening's per-criterion findings. */
    readonly scoreReasons: ReadonlyArray<ScoreReason>
    /** The screening's one-paragraph summary. */
    readonly scoreSummary: string | null
    /** When the screening ran. */
    readonly screenedAt: string | null
    /** When the stage last changed. */
    readonly stageChangedAt: string
    /** Why a rejected candidate was refused. */
    readonly rejectedReason: string | null
    /** The manager's private notes. */
    readonly notes: string
    /** When the application arrived. */
    readonly createdAt: string
}

/** One interview of the workbench. */
export interface HiringInterviewView extends InterviewRecord {
    /** When the reminder went out. */
    readonly reminderSentAt: string | null
    /** When it was created. */
    readonly createdAt: string
}

/** One offer of the workbench. */
export interface HiringOfferView extends OfferRecord {
    /** How it was sent. */
    readonly sentVia: string | null
    /** When it was sent. */
    readonly sentAt: string | null
    /** When the candidate answered. */
    readonly respondedAt: string | null
    /** When it was created. */
    readonly createdAt: string
}

/** One onboarding step. */
export interface HiringOnboardingView {
    /** The step id. */
    readonly id: string
    /** The candidate the step belongs to. */
    readonly candidateId: string
    /** What the step asks. */
    readonly title: string
    /** Whether it is done. */
    readonly done: boolean
    /** When it was done. */
    readonly doneAt: string | null
    /** Its place in the list. */
    readonly sort: number
}

/** One weekly availability window of a member. */
export interface HiringWindowView {
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** Minutes from midnight, Vietnam time. */
    readonly startMin: number
    /** Minutes from midnight, Vietnam time. */
    readonly endMin: number
}

/** One member who can interview, with their free windows. */
export interface HiringMemberView {
    /** The member's user id. */
    readonly userId: string
    /** The display name. */
    readonly name: string
    /** The workspace role. */
    readonly role: string
    /** The weekly windows the member is free. */
    readonly windows: ReadonlyArray<HiringWindowView>
}

/** The whole hiring workbench a manager sees. */
export interface HiringBenchView {
    /** When the view was read. */
    readonly nowIso: string
    /** The site origin links are built with. */
    readonly origin: string
    /** The hiring settings. */
    readonly settings: HiringSettings
    /** Every job, newest first, with its public link. */
    readonly jobs: ReadonlyArray<HiringJobView>
    /** The newest candidates. */
    readonly candidates: ReadonlyArray<HiringCandidateView>
    /** The newest interviews. */
    readonly interviews: ReadonlyArray<HiringInterviewView>
    /** The newest offers. */
    readonly offers: ReadonlyArray<HiringOfferView>
    /** The onboarding steps. */
    readonly onboarding: ReadonlyArray<HiringOnboardingView>
    /** The members and their free windows. */
    readonly members: ReadonlyArray<HiringMemberView>
    /** Decisions waiting for the manager. */
    readonly waitingApprovals: number
    /** The ribbon figures. */
    readonly figures: HiringFiguresView
    /** The caller's user id. */
    readonly meUserId: string
}

/** One line of a candidate's timeline. */
export interface HiringEventView {
    /** The event id. */
    readonly id: string
    /** What kind of event it is. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** The one-line summary. */
    readonly summary: string
    /** When it happened. */
    readonly createdAt: string
}

/** The CV link of a candidate. */
export interface HiringCvView {
    /** The signed download link. */
    readonly url: string
    /** The file name. */
    readonly name: string
    /** The file mime type. */
    readonly mime: string
}

/** What the candidate drawer opens with. */
export interface HiringCandidateDetailView {
    /** The candidate's timeline. */
    readonly events: ReadonlyArray<HiringEventView>
    /** The CV link, when there is one. */
    readonly cv: HiringCvView | null
}
