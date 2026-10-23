/** What the request to read the hiring settings of the workspace, creating them on first use answers. */
export interface EnsureSettingsOutput {
    /** The slug of the workspace's public job pages. */
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

/** What the request to change the hiring settings takes. */
export interface SaveSettingsParams {
    /** The new public slug. */
    readonly publicSlug?: string
    /** Days a rejected or withdrawn candidate is kept. */
    readonly retentionDays?: number
    /** Whether a new candidate is announced in the Office. */
    readonly notifyNewCandidate?: boolean
    /** Whether confirmed interviews are reminded. */
    readonly remindInterview?: boolean
    /** Whether a job closes once enough people accepted. */
    readonly autoCloseWhenFilled?: boolean
    /** The consent text an applicant agrees to. */
    readonly applyConsentText?: string
    /** The tone of generated ads. */
    readonly adTone?: string
}

/** The written requirements of a job. */
export interface JobRequirementsInput {
    /** Skills the job needs. */
    readonly skills: ReadonlyArray<string>
    /** The years of experience asked. */
    readonly experienceYears?: number | null
    /** A note about the experience. */
    readonly experienceNote: string
    /** The days and hours the job needs. */
    readonly availability: ReadonlyArray<string>
    /** Requirements a candidate must meet. */
    readonly mustHave: ReadonlyArray<string>
    /** Requirements that count in a candidate's favour. */
    readonly niceToHave: ReadonlyArray<string>
}

/** One question of a job. */
export interface JobQuestionInput {
    /** The question id inside the job; empty gets a generated one. */
    readonly id?: string
    /** The question text. */
    readonly text: string
    /** The kind of answer. */
    readonly type: "text" | "yesno" | "number" | "choice"
    /** Whether an answer is required. */
    readonly required: boolean
    /** The offered choices of a choice question. */
    readonly choices?: ReadonlyArray<string>
    /** The expected answer of a yes or no question. */
    readonly expectYesNo?: "yes" | "no"
    /** The minimum of a number question. */
    readonly expectNumber?: number
    /** The accepted choices of a choice question. */
    readonly expectChoices?: ReadonlyArray<string>
}

/** What the request to create or update one job post takes. */
export interface SaveJobParams {
    /** The job to update; absent creates one. */
    readonly id?: string
    /** The post title. */
    readonly title: string
    /** The position name. */
    readonly position?: string
    /** How the job is worked. */
    readonly employmentType?: "full_time" | "part_time"
    /** The work schedule. */
    readonly schedule?: string
    /** The lowest pay. */
    readonly payMinVnd?: number | null | undefined
    /** The highest pay. */
    readonly payMaxVnd?: number | null | undefined
    /** The unit of the pay. */
    readonly payUnit?: "month" | "hour" | "shift"
    /** The place of work. */
    readonly location?: string
    /** How many people are wanted. */
    readonly headcount?: number
    /** The description. */
    readonly description?: string
    /** The written requirements. */
    readonly requirements?: JobRequirementsInput
    /** The questions applicants answer. */
    readonly questions: ReadonlyArray<JobQuestionInput>
    /** The channels the job takes applications from. */
    readonly channels?: ReadonlyArray<string>
    /** When the job stops taking applications. */
    readonly closesAt?: string | null
}

/** What the request to create or update one job post answers. */
export interface SaveJobOutput {
    /** The job id. */
    readonly id: string
    /** The slug in the public link. */
    readonly slug: string
}

/** What the request to open, pause or close a job takes. */
export interface SetJobStatusParams {
    /** The job. */
    readonly id: string
    /** The new status. */
    readonly status: "draft" | "open" | "paused" | "closed"
}

/** What the request to open, pause or close a job answers. */
export interface SetJobStatusOutput {
    /** The status now. */
    readonly status: string
}

/** What the request to draft the copy-ready ads of a job takes. */
export interface GenerateAdParams {
    /** The job. */
    readonly jobId: string
}

/** What the request to draft the copy-ready ads of a job answers. */
export interface GenerateAdOutput {
    /** The Facebook group post. */
    readonly facebook: string
    /** The Zalo group message. */
    readonly zalo: string
    /** The job board post. */
    readonly topcv: string
    /** When it was written. */
    readonly generatedAt: string
    /** How long the model took. */
    readonly ms: number
    /** Model calls made. */
    readonly attempts: number
    /** Whether lines about protected traits were removed. */
    readonly sanitised: boolean
}

/** What the request to move a candidate to another stage takes. */
export interface MoveCandidateParams {
    /** The candidate. */
    readonly id: string
    /** The new stage. */
    readonly stage: "applied" | "screening" | "shortlisted" | "interview" | "offer" | "hired" | "rejected" | "withdrawn"
    /** Why the candidate is rejected. */
    readonly reason?: string
}

/** What the request to move a candidate to another stage answers. */
export interface MoveCandidateOutput {
    /** The stage now. */
    readonly stage: string
}

/** What the request to save the notes about a candidate takes. */
export interface SaveNotesParams {
    /** The candidate. */
    readonly id: string
    /** The notes. */
    readonly notes: string
}

/** What the request to delete a candidate with every trace takes. */
export interface DeleteCandidateParams {
    /** The candidate. */
    readonly id: string
}

/** What the request to delete a candidate with every trace answers. */
export interface DeleteCandidateOutput {
    /** CV files deleted. */
    readonly files: number
}

/** What the request to screen a candidate again takes. */
export interface RescreenParams {
    /** The candidate. */
    readonly id: string
}

/** What the request to screen a candidate again answers. */
export interface RescreenOutput {
    /** The status of the decision. */
    readonly status: string
    /** One line saying what happened. */
    readonly summary: string
    /** Why it failed. */
    readonly error: string | null
}

/** What the request to get a short-lived link to a candidate's CV takes. */
export interface CandidateCvParams {
    /** The candidate. */
    readonly id: string
}

/** What the request to get a short-lived link to a candidate's CV answers. */
export interface CandidateCvOutput {
    /** The link, absent when the candidate has no CV. */
    readonly url: string | null
    /** The file name. */
    readonly name: string | null
    /** The media type. */
    readonly mime: string | null
}

/** What the request to create a staff profile from a hired candidate takes. */
export interface LinkStaffParams {
    /** The hired candidate. */
    readonly candidateId: string
}

/** What the request to create a staff profile from a hired candidate answers. */
export interface LinkStaffOutput {
    /** The staff profile. */
    readonly staffId: string
}

/** What the request to arrange an interview for a candidate takes. */
export interface RequestInterviewParams {
    /** The candidate. */
    readonly candidateId: string
    /** The member who interviews; absent means the owner. */
    readonly interviewerUserId?: string
    /** In person or online. */
    readonly mode: "in_person" | "online"
    /** The address, or the online link. */
    readonly location: string
    /** The length in minutes. */
    readonly durationMin: number
}

/** What the request to arrange an interview for a candidate answers. */
export interface RequestInterviewOutput {
    /** The status of the decision. */
    readonly status: string
    /** One line saying what happened. */
    readonly summary: string
    /** Why it failed. */
    readonly error: string | null
}

/** What the request to mark an interview done, cancelled or missed takes. */
export interface SetInterviewStatusParams {
    /** The interview. */
    readonly id: string
    /** The new status. */
    readonly status: "done" | "cancelled" | "no_show"
}

/** What the request to draft an offer for a candidate and ask for approval takes. */
export interface RequestOfferParams {
    /** The candidate. */
    readonly candidateId: string
    /** The position as written in the offer. */
    readonly title: string
    /** The pay. */
    readonly pay: string
    /** The start date. */
    readonly startDate: string
    /** The probation. */
    readonly probation: string
    /** A free note. */
    readonly note: string
}

/** What the request to draft an offer for a candidate and ask for approval answers. */
export interface RequestOfferOutput {
    /** The status of the decision. */
    readonly status: string
    /** One line saying what happened. */
    readonly summary: string
    /** Why it failed. */
    readonly error: string | null
}

/** What the request to cancel an offer takes. */
export interface CancelOfferParams {
    /** The offer. */
    readonly id: string
}

/** What the request to tick or untick an onboarding item takes. */
export interface ToggleOnboardingParams {
    /** The item. */
    readonly id: string
    /** Whether it is done. */
    readonly done: boolean
}

/** One free window. */
export interface AvailabilityWindowInput {
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** Minutes from midnight. */
    readonly startMin: number
    /** Minutes from midnight. */
    readonly endMin: number
}

/** What the request to replace the weekly free times of a member takes. */
export interface SaveAvailabilityParams {
    /** The member. */
    readonly memberUserId: string
    /** The free windows. */
    readonly windows: ReadonlyArray<AvailabilityWindowInput>
}

/** What the request to replace the weekly free times of a member answers. */
export interface SaveAvailabilityOutput {
    /** Windows saved. */
    readonly saved: number
}
