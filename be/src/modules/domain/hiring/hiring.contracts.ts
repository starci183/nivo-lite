/** Every stage a candidate can be in. */
export const STAGES = [
    "applied",
    "screening",
    "shortlisted",
    "interview",
    "offer",
    "hired",
    "rejected",
    "withdrawn",
] as const

/** A stage of the hiring pipeline. */
export type Stage = (typeof STAGES)[number]

/** Whether a job accepts applications. */
export type JobStatus = "draft" | "open" | "paused" | "closed"

/** How a job is worked. */
export type EmploymentType = "full_time" | "part_time"

/** The unit a job's pay is quoted in. */
export type PayUnit = "month" | "hour" | "shift"

/** The kind of answer a job question takes. */
export type QuestionType = "text" | "yesno" | "number" | "choice"

/** What a scored question expects: yes or no, a minimum number, or the accepted choices. */
export type QuestionExpect = "yes" | "no" | number | ReadonlyArray<string>

/** One question a job asks its applicants. */
export interface JobQuestion {
    /** The question id inside the job. */
    readonly id: string
    /** The question text candidates read. */
    readonly text: string
    /** The kind of answer. */
    readonly type: QuestionType
    /** Whether an answer is required. */
    readonly required: boolean
    /** The offered choices of a choice question. */
    readonly choices?: ReadonlyArray<string>
    /** What the question scores against; absent means it is only collected. */
    readonly expect?: QuestionExpect
}

/** The written requirements a candidate is compared with. */
export interface JobRequirements {
    /** Skills the job needs. */
    readonly skills: ReadonlyArray<string>
    /** The years of experience asked, when any. */
    readonly experienceYears: number | null
    /** A note about the experience. */
    readonly experienceNote: string
    /** The days and hours the job needs. */
    readonly availability: ReadonlyArray<string>
    /** Requirements a candidate must meet. */
    readonly mustHave: ReadonlyArray<string>
    /** Requirements that count in a candidate's favour. */
    readonly niceToHave: ReadonlyArray<string>
}

/** The texts of a job that candidates read or screening uses; the fairness check runs over them. */
export interface JobDraftTexts {
    /** The post title. */
    readonly title: string
    /** The position name. */
    readonly position?: string
    /** The description. */
    readonly description: string
    /** The work schedule. */
    readonly schedule?: string
    /** The requirements. */
    readonly requirements: JobRequirements
    /** The questions. */
    readonly questions: ReadonlyArray<JobQuestion>
}

/** A protected trait the screening never uses. */
export type FairnessCategory =
    "gender" | "age" | "religion" | "ethnicity" | "marital" | "pregnancy" | "disability" | "hometown" | "appearance"

/** One place a text asks for, or screens on, a protected trait. */
export interface FairnessViolation {
    /** The trait. */
    readonly category: FairnessCategory
    /** The words found, with a little context. */
    readonly excerpt: string
    /** Which part of the job the words are in. */
    readonly field: string
}

/** One answer a candidate gave. */
export interface Answer {
    /** The question id. */
    readonly questionId: string
    /** The question text at the time. */
    readonly question: string
    /** The answer. */
    readonly answer: string
}

/** Whether a criterion is met. */
export type ReasonStatus = "met" | "unmet" | "unknown"

/** One line of the screening checklist. */
export interface ScoreReason {
    /** The criterion. */
    readonly criterion: string
    /** The verdict. */
    readonly status: ReasonStatus
    /** The explanation. */
    readonly note: string
}

/** The advice label of a score. */
export type ScoreLabel = "fit" | "consider" | "not_fit"

/** The result of the deterministic screening. */
export interface Screening {
    /** The score from 0 to 100. */
    readonly score: number
    /** The advice label. */
    readonly label: ScoreLabel
    /** The checklist. */
    readonly reasons: ReadonlyArray<ScoreReason>
}

/** The candidate's answers and availability, all the screening reads. */
export interface ScreenedPerson {
    /** The answers to the job's questions. */
    readonly answers: ReadonlyArray<Answer>
    /** The days and hours they can work. */
    readonly availability: string
}

/** The text lookup the pure policies use for the words they write: a catalogue key and its parameters. */
export type TextOf = (key: string, params: Readonly<Record<string, string | number>>) => string

/** The stored settings of one workspace's hiring. */
export interface HiringSettings {
    /** The workspace. */
    readonly workspaceId: string
    /** The public slug of the workspace's job pages. */
    readonly publicSlug: string
    /** Days a rejected or withdrawn candidate is kept. */
    readonly retentionDays: number
    /** Whether a new candidate is announced in the Office. */
    readonly notifyNewCandidate: boolean
    /** Whether confirmed interviews are reminded. */
    readonly remindInterview: boolean
    /** Whether a job closes once enough people accepted. */
    readonly autoCloseWhenFilled: boolean
    /** The consent text an applicant agrees to. */
    readonly applyConsentText: string
    /** The tone of generated ads. */
    readonly adTone: string
}

/** A stored job. */
export interface JobRecord {
    /** The job id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The slug in the public link. */
    readonly slug: string
    /** The post title. */
    readonly title: string
    /** The position name. */
    readonly position: string
    /** How the job is worked. */
    readonly employmentType: EmploymentType
    /** The work schedule. */
    readonly schedule: string
    /** The lowest pay, when stated. */
    readonly payMinVnd: number | null
    /** The highest pay, when stated. */
    readonly payMaxVnd: number | null
    /** The unit of the pay. */
    readonly payUnit: PayUnit
    /** The place of work. */
    readonly location: string
    /** How many people are wanted. */
    readonly headcount: number
    /** The description. */
    readonly description: string
    /** The requirements. */
    readonly requirements: JobRequirements
    /** The questions. */
    readonly questions: ReadonlyArray<JobQuestion>
    /** The status. */
    readonly status: JobStatus
    /** The channels the job takes applications from (page, chat). */
    readonly channels: ReadonlyArray<string>
    /** When the job stops taking applications. */
    readonly closesAt: string | null
}

/** Where an application came from. */
export type ApplicationSource = "page" | "chat" | "manual"

/** A stored candidate, with what the flows need. */
export interface CandidateRecord {
    /** The candidate id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The job applied for. */
    readonly jobId: string
    /** The candidate's name. */
    readonly name: string
    /** The phone, digits only. */
    readonly phone: string
    /** The email. */
    readonly email: string
    /** Where the application came from. */
    readonly source: ApplicationSource
    /** The chat conversation of a chat application. */
    readonly conversationId: string | null
    /** The stored CV file path. */
    readonly cvPath: string | null
    /** The CV file name. */
    readonly cvName: string | null
    /** The CV media type. */
    readonly cvMime: string | null
    /** The answers. */
    readonly answers: ReadonlyArray<Answer>
    /** The days and hours they can work. */
    readonly availability: string
    /** The stage. */
    readonly stage: Stage
    /** The staff profile created from this candidate. */
    readonly staffId: string | null
}

/** A proposed or confirmed interview time. */
export interface Slot {
    /** The start, ISO. */
    readonly start: string
    /** The end, ISO. */
    readonly end: string
}

/** Where an interview stands: proposed to the candidate, confirmed by their pick, then done, cancelled or missed. */
export type InterviewStatus = "proposed" | "confirmed" | "done" | "cancelled" | "no_show"

/** A stored interview. */
export interface InterviewRecord {
    /** The interview id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The candidate. */
    readonly candidateId: string
    /** The job. */
    readonly jobId: string
    /** The interviewer account. */
    readonly interviewerUserId: string | null
    /** The interviewer's name. */
    readonly interviewerName: string
    /** In person or online. */
    readonly mode: "in_person" | "online"
    /** The address, or the online link. */
    readonly location: string
    /** The length in minutes. */
    readonly durationMin: number
    /** The times offered to the candidate. */
    readonly proposedSlots: ReadonlyArray<Slot>
    /** The confirmed start. */
    readonly slotStart: string | null
    /** The confirmed end. */
    readonly slotEnd: string | null
    /** The status. */
    readonly status: InterviewStatus
    /** The token in the candidate's link. */
    readonly token: string
    /** The decision that allowed the invitation. */
    readonly workItemId: string | null
    /** A note from the candidate. */
    readonly note: string
}

/** Where an offer stands: from the draft the owner approves, to sent, to the candidate answer or its lapse. */
export type OfferStatus = "draft" | "waiting" | "sent" | "accepted" | "declined" | "expired" | "cancelled"

/** The terms the owner types for an offer, kept as written so the letter never drifts from them. */
export interface OfferTerms {
    /** The position. */
    readonly title: string
    /** The pay as written. */
    readonly pay: string
    /** The start date as written. */
    readonly startDate: string
    /** The probation as written. */
    readonly probation: string
    /** A free note. */
    readonly note: string
}

/** A stored offer. */
export interface OfferRecord {
    /** The offer id. */
    readonly id: string
    /** The workspace. */
    readonly workspaceId: string
    /** The candidate. */
    readonly candidateId: string
    /** The job. */
    readonly jobId: string
    /** The terms. */
    readonly terms: OfferTerms
    /** The letter text. */
    readonly draft: string
    /** The status. */
    readonly status: OfferStatus
    /** The token in the candidate's link. */
    readonly token: string
    /** The decision that carries the owner's approval. */
    readonly workItemId: string | null
    /** When the offer lapses. */
    readonly expiresAt: string | null
}

/** One weekly availability window of a member. */
export interface AvailabilityWindow {
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** Minutes from midnight, Vietnam time. */
    readonly startMin: number
    /** Minutes from midnight, Vietnam time. */
    readonly endMin: number
}

/** How a message to a candidate was delivered. */
export interface Delivery {
    /** The channel that carried it. */
    readonly via: "chat" | "email" | "manual"
    /** Whether the candidate was reached. */
    readonly delivered: boolean
    /** One line saying what happened, in the shop's language. */
    readonly note: string
}

/** The work item states a gate answer can carry. */
export interface GateOutcome {
    /** The status of the decision. */
    readonly status: string
    /** The decision that records it. */
    readonly workItemId: string
}
