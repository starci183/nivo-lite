/** The requirements column of public.hiring_jobs as stored (snake case keys, any key may be missing). */
export interface RequirementsRow {
    /** Skills. */
    readonly skills?: Array<string>
    /** Years of experience. */
    readonly experience_years?: number | null
    /** Experience note. */
    readonly experience_note?: string
    /** Availability. */
    readonly availability?: Array<string>
    /** Must have. */
    readonly must_have?: Array<string>
    /** Nice to have. */
    readonly nice_to_have?: Array<string>
}

/** One entry of the questions column as stored. */
export interface QuestionRow {
    /** The question id. */
    readonly id: string
    /** The question text. */
    readonly text: string
    /** The kind of answer. */
    readonly type: string
    /** Whether an answer is required. */
    readonly required: boolean
    /** The offered choices. */
    readonly choices?: Array<string>
    /** What it scores against. */
    readonly expect?: string | number | Array<string>
}

/** One entry of the answers column as stored. */
export interface AnswerRow {
    /** The question id. */
    readonly question_id: string
    /** The question text. */
    readonly question: string
    /** The answer. */
    readonly answer: string
}

/** One entry of the proposed slots column as stored. */
export interface SlotRow {
    /** The start. */
    readonly start: string
    /** The end. */
    readonly end: string
}

/** The terms column of public.hiring_offers as stored. */
export interface TermsRow {
    /** The position. */
    readonly title?: string
    /** The pay. */
    readonly pay?: string
    /** The start date. */
    readonly start_date?: string
    /** The probation. */
    readonly probation?: string
    /** A free note. */
    readonly note?: string
}

/** The columns of public.hiring_settings the domain reads. */
export interface HiringSettingsRow {
    /** The workspace. */
    readonly workspace_id: string
    /** The public slug. */
    readonly public_slug: string
    /** Days a closed candidate is kept. */
    readonly retention_days: number
    /** Announce new candidates. */
    readonly notify_new_candidate: boolean
    /** Remind interviews. */
    readonly remind_interview: boolean
    /** Close a filled job. */
    readonly auto_close_when_filled: boolean
    /** The consent text. */
    readonly apply_consent_text: string
    /** The ad tone. */
    readonly ad_tone: string
}

/** The columns of public.hiring_jobs the domain reads; bigint columns arrive as text. */
export interface HiringJobsRow {
    /** The job id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The slug. */
    readonly slug: string
    /** The title. */
    readonly title: string
    /** The position. */
    readonly position: string
    /** The employment type. */
    readonly employment_type: string
    /** The schedule. */
    readonly schedule: string
    /** The lowest pay. */
    readonly pay_min_vnd: number | string | null
    /** The highest pay. */
    readonly pay_max_vnd: number | string | null
    /** The pay unit. */
    readonly pay_unit: string
    /** The location. */
    readonly location: string
    /** The headcount. */
    readonly headcount: number
    /** The description. */
    readonly description: string
    /** The requirements. */
    readonly requirements: RequirementsRow | null
    /** The questions. */
    readonly questions: Array<QuestionRow> | null
    /** The status. */
    readonly status: string
    /** The channels. */
    readonly channels: Array<string>
    /** When applications stop. */
    readonly closes_at: Date | string | null
}

/** The columns of public.hiring_candidates the domain reads. */
export interface HiringCandidatesRow {
    /** The candidate id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The job. */
    readonly job_id: string
    /** The name. */
    readonly name: string
    /** The phone. */
    readonly phone: string
    /** The email. */
    readonly email: string
    /** The source. */
    readonly source: string
    /** The chat conversation. */
    readonly conversation_id: string | null
    /** The CV path. */
    readonly cv_path: string | null
    /** The CV name. */
    readonly cv_name: string | null
    /** The CV media type. */
    readonly cv_mime: string | null
    /** The answers. */
    readonly answers: Array<AnswerRow> | null
    /** The availability. */
    readonly availability: string
    /** The stage. */
    readonly stage: string
    /** The staff profile. */
    readonly staff_id: string | null
}

/** The columns of public.hiring_interviews the domain reads. */
export interface HiringInterviewsRow {
    /** The interview id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The candidate. */
    readonly candidate_id: string
    /** The job. */
    readonly job_id: string
    /** The interviewer account. */
    readonly interviewer_user_id: string | null
    /** The interviewer name. */
    readonly interviewer_name: string
    /** The mode. */
    readonly mode: string
    /** The location. */
    readonly location: string
    /** The length. */
    readonly duration_min: number
    /** The proposed slots. */
    readonly proposed_slots: Array<SlotRow> | null
    /** The confirmed start. */
    readonly slot_start: Date | string | null
    /** The confirmed end. */
    readonly slot_end: Date | string | null
    /** The status. */
    readonly status: string
    /** The link token. */
    readonly token: string
    /** The decision. */
    readonly work_item_id: string | null
    /** The note. */
    readonly note: string
}

/** The columns of public.hiring_offers the domain reads. */
export interface HiringOffersRow {
    /** The offer id. */
    readonly id: string
    /** The workspace. */
    readonly workspace_id: string
    /** The candidate. */
    readonly candidate_id: string
    /** The job. */
    readonly job_id: string
    /** The terms. */
    readonly terms: TermsRow | null
    /** The letter. */
    readonly draft: string
    /** The status. */
    readonly status: string
    /** The link token. */
    readonly token: string
    /** The decision. */
    readonly work_item_id: string | null
    /** When the offer lapses. */
    readonly expires_at: Date | string | null
}

/** A workspace that uses hiring, with what the tick needs. */
export interface TickWorkspaceRow {
    /** The workspace. */
    readonly workspace_id: string
    /** Days a closed candidate is kept. */
    readonly retention_days: number
    /** Remind interviews. */
    readonly remind_interview: boolean
}

/** A member who can interview. */
export interface MemberNameRow {
    /** The account. */
    readonly user_id: string
    /** The display name. */
    readonly display_name: string
}

/** The owner of a workspace and its members, to pick the default interviewer. */
export interface InterviewerRow extends MemberNameRow {
    /** True for the owner of the workspace. */
    readonly is_owner: boolean
}

/** The id of a row a function wrote. */
export interface IdRow {
    /** The id; null when the row to change was missing. */
    readonly id: string | null
}

/** A text a function answered. */
export interface TextRow {
    /** The text. */
    readonly value: string | null
}

/** A number a function or count answered; bigint counts arrive as text. */
export interface CountRow {
    /** The count. */
    readonly count: number | string
}

/** The answer of the submit-application function. */
export interface SubmitRow {
    /** The candidate id. */
    readonly id: string
    /** True when the applicant had already applied. */
    readonly duplicate: boolean
}

/** The answer of the close-if-filled function. */
export interface FilledRow {
    /** True when the job was closed now. */
    readonly closed: boolean
    /** The job title. */
    readonly title: string
    /** The people who accepted. */
    readonly hired: number | string
    /** The people wanted. */
    readonly headcount: number
}

/** A candidate id and a CV path. */
export interface CandidateFileRow {
    /** The candidate. */
    readonly id: string
    /** The CV path. */
    readonly cv_path: string | null
}

/** A candidate id only. */
export interface CandidateIdRow {
    /** The candidate. */
    readonly candidate_id: string
}

/** The title of a job closed by the sweep. */
export interface TitleRow {
    /** The title. */
    readonly title: string
}

/** The job title and location of an offer or interview. */
export interface JobHeadRow {
    /** The title. */
    readonly title: string
    /** The location. */
    readonly location: string
    /** The position. */
    readonly position: string
}

/** The candidate id and name. */
export interface CandidateHeadRow {
    /** The candidate. */
    readonly id: string
    /** The name. */
    readonly name: string
}

/** One availability row of a member. */
export interface AvailabilityRow {
    /** The weekday. */
    readonly weekday: number
    /** Start minute. */
    readonly start_min: number
    /** End minute. */
    readonly end_min: number
}

/** The slots of an interviewer that are not free. */
export interface BusyRow {
    /** The confirmed start. */
    readonly slot_start: Date | string | null
    /** The confirmed end. */
    readonly slot_end: Date | string | null
    /** The proposed slots. */
    readonly proposed_slots: Array<SlotRow> | null
    /** The status. */
    readonly status: string
}

/** The conversation a candidate chatted in. */
export interface ChannelRow {
    /** The channel name. */
    readonly channel: string | null
}

/** A plan of the retention sweep for one workspace. */
export interface DueCandidateRow {
    /** The candidate. */
    readonly id: string
}

/** The shape the staff link function answers. */
export interface StaffLinkRow {
    /** The new staff profile; null when the shifts tables are not there. */
    readonly staff_id: string | null
    /** True when the shifts tables are missing. */
    readonly missing: boolean
}

/** A cancelled offer and the decision behind it. */
export interface CancelledOfferRow {
    /** The candidate. */
    readonly candidate_id: string
    /** The decision. */
    readonly work_item_id: string | null
}

/** A single boolean answer of a function. */
export interface FlagRow {
    /** The answer. */
    readonly value: boolean
}

/** A list of titles a function answers. */
export interface TitlesRow {
    /** The titles. */
    readonly titles: Array<string>
}

/** A list of file paths a function answers. */
export interface PathsRow {
    /** The paths. */
    readonly paths: Array<string>
}

/** A list of ids a function answers. */
export interface IdsRow {
    /** The ids. */
    readonly ids: Array<string>
}
