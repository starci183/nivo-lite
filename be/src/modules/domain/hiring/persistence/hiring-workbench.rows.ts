import type { ScoreLabel, ScoreReason, Stage } from "../hiring.contracts"
import type { AnswerRow, QuestionRow, RequirementsRow, SlotRow, TermsRow } from "./hiring.rows"

/** The columns of public.hiring_jobs the workbench reads. */
export interface WorkbenchJobRow {
    /** The job id. */
    readonly id: string
    /** The workspace the job belongs to. */
    readonly workspace_id: string
    /** The url slug of the public page. */
    readonly slug: string
    /** The job title. */
    readonly title: string
    /** The position it fills. */
    readonly position: string
    /** Full time, part time and so on. */
    readonly employment_type: string
    /** The working schedule in words. */
    readonly schedule: string
    /** The lower bound of the pay. */
    readonly pay_min_vnd: number | string | null
    /** The upper bound of the pay. */
    readonly pay_max_vnd: number | string | null
    /** What the pay is per: month, day, hour. */
    readonly pay_unit: string
    /** Where the job is. */
    readonly location: string
    /** How many people the job hires. */
    readonly headcount: number
    /** The job description. */
    readonly description: string
    /** The structured requirements, when set. */
    readonly requirements: RequirementsRow | null
    /** The screening questions, when set. */
    readonly questions: Array<QuestionRow> | null
    /** open, paused or closed. */
    readonly status: string
    /** Where the job is advertised. */
    readonly channels: Array<string>
    /** The generated ad texts, when made. */
    readonly ad_variants: Record<string, unknown> | null
    /** When applications close. */
    readonly closes_at: Date | string | null
    /** When the job was created. */
    readonly created_at: Date | string
    /** When the job was last edited. */
    readonly updated_at: Date | string
}

/** The columns of public.hiring_candidates the workbench reads. */
export interface WorkbenchCandidateRow {
    /** The candidate id. */
    readonly id: string
    /** The workspace the candidate belongs to. */
    readonly workspace_id: string
    /** The job applied for. */
    readonly job_id: string
    /** The candidate's name. */
    readonly name: string
    /** The candidate's phone. */
    readonly phone: string
    /** The candidate's email. */
    readonly email: string
    /** Where the application came from. */
    readonly source: string
    /** The chat the application came through, when it did. */
    readonly conversation_id: string | null
    /** The CV storage path. */
    readonly cv_path: string | null
    /** The CV file name. */
    readonly cv_name: string | null
    /** The CV mime type. */
    readonly cv_mime: string | null
    /** The CV file size in bytes. */
    readonly cv_size: number | null
    /** The answers to the screening questions. */
    readonly answers: Array<AnswerRow> | null
    /** The availability the candidate stated. */
    readonly availability: string
    /** The screening score, 0 to 100. */
    readonly score: number | null
    /** The screening verdict. */
    readonly score_label: ScoreLabel | null
    /** The screening's per-criterion findings. */
    readonly score_reasons: Array<ScoreReason> | null
    /** The screening's one-paragraph summary. */
    readonly score_summary: string | null
    /** When the screening ran. */
    readonly screened_at: Date | string | null
    /** The pipeline stage. */
    readonly stage: Stage
    /** When the stage last changed. */
    readonly stage_changed_at: Date | string
    /** Why a rejected candidate was refused. */
    readonly rejected_reason: string | null
    /** The manager's private notes. */
    readonly notes: string
    /** The staff row the hire became, when linked. */
    readonly staff_id: string | null
    /** When the application arrived. */
    readonly created_at: Date | string
}

/** The columns of public.hiring_interviews the workbench reads. */
export interface WorkbenchInterviewRow {
    /** The interview id. */
    readonly id: string
    /** The workspace the interview belongs to. */
    readonly workspace_id: string
    /** The candidate. */
    readonly candidate_id: string
    /** The job. */
    readonly job_id: string
    /** The member who interviews, when picked. */
    readonly interviewer_user_id: string | null
    /** The interviewer's display name. */
    readonly interviewer_name: string
    /** Online, call or on site. */
    readonly mode: string
    /** Where it happens. */
    readonly location: string
    /** How long it takes. */
    readonly duration_min: number
    /** The slots proposed to the candidate. */
    readonly proposed_slots: Array<SlotRow> | null
    /** The chosen slot's start. */
    readonly slot_start: Date | string | null
    /** The chosen slot's end. */
    readonly slot_end: Date | string | null
    /** proposed, confirmed, done, cancelled or declined. */
    readonly status: string
    /** The public answer token. */
    readonly token: string
    /** The approval the sending waits on, when it does. */
    readonly work_item_id: string | null
    /** When the reminder went out. */
    readonly reminder_sent_at: Date | string | null
    /** A note for the interviewer. */
    readonly note: string
    /** When it was created. */
    readonly created_at: Date | string
}

/** The columns of public.hiring_offers the workbench reads. */
export interface WorkbenchOfferRow {
    /** The offer id. */
    readonly id: string
    /** The workspace the offer belongs to. */
    readonly workspace_id: string
    /** The candidate. */
    readonly candidate_id: string
    /** The job. */
    readonly job_id: string
    /** The offer terms. */
    readonly terms: TermsRow | null
    /** The letter draft. */
    readonly draft: string
    /** draft, waiting, sent, accepted, declined or cancelled. */
    readonly status: string
    /** The public answer token. */
    readonly token: string
    /** The approval the sending waits on, when it does. */
    readonly work_item_id: string | null
    /** How it was sent. */
    readonly sent_via: string | null
    /** When it was sent. */
    readonly sent_at: Date | string | null
    /** When it lapses. */
    readonly expires_at: Date | string | null
    /** When the candidate answered. */
    readonly responded_at: Date | string | null
    /** When it was created. */
    readonly created_at: Date | string
}

/** One onboarding step of public.hiring_onboarding. */
export interface WorkbenchOnboardingRow {
    /** The step id. */
    readonly id: string
    /** The candidate the step belongs to. */
    readonly candidate_id: string
    /** What the step asks. */
    readonly title: string
    /** Whether it is done. */
    readonly done: boolean
    /** When it was done. */
    readonly done_at: Date | string | null
    /** Its place in the list. */
    readonly sort: number
}

/** One active member row of public.workspace_members. */
export interface WorkbenchMemberRow {
    /** The member's user id. */
    readonly user_id: string
    /** The display name. */
    readonly display_name: string
    /** The workspace role. */
    readonly role: string
}

/** One availability window of public.hiring_availability. */
export interface WorkbenchAvailabilityRow {
    /** The member the window belongs to. */
    readonly member_user_id: string
    /** The weekday, 0 (Sunday) to 6. */
    readonly weekday: number
    /** Minutes from midnight, Vietnam time. */
    readonly start_min: number
    /** Minutes from midnight, Vietnam time. */
    readonly end_min: number
}

/** One event of public.hiring_events. */
export interface HiringEventRow {
    /** The event id. */
    readonly id: string
    /** What kind of event it is. */
    readonly kind: string
    /** Who did it. */
    readonly actor: string
    /** The one-line summary. */
    readonly summary: string
    /** When it happened. */
    readonly created_at: Date | string
}

/** The six ribbon figures, in one row. */
export interface HiringFiguresRow {
    /** Jobs open now. */
    readonly open_roles: number | string
    /** All jobs. */
    readonly total_roles: number | string
    /** Candidates still moving through the pipeline. */
    readonly pipeline: number | string
    /** Confirmed interviews this week. */
    readonly interviews_week: number | string
    /** Offers waiting for the manager's approval. */
    readonly offers_waiting: number | string
    /** Offers sent, waiting for the candidate. */
    readonly offers_sent: number | string
}

/** A count answer. */
export interface CountRow {
    /** The count. */
    readonly n: number | string
}
