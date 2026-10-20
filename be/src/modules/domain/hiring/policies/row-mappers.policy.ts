import type {
    Answer,
    ApplicationSource,
    CandidateRecord,
    EmploymentType,
    HiringSettings,
    InterviewRecord,
    InterviewStatus,
    JobQuestion,
    JobRecord,
    JobRequirements,
    JobStatus,
    OfferRecord,
    OfferStatus,
    OfferTerms,
    PayUnit,
    QuestionExpect,
    QuestionType,
    Slot,
    Stage,
} from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type {
    AnswerRow,
    HiringCandidatesRow,
    HiringInterviewsRow,
    HiringJobsRow,
    HiringOffersRow,
    HiringSettingsRow,
    QuestionRow,
    RequirementsRow,
    SlotRow,
    TermsRow,
} from "../persistence/hiring.rows"
import { isoOrNull } from "./vn-time.policy"

const QUESTION_TYPES: ReadonlyArray<QuestionType> = ["text", "yesno", "number", "choice"]
const JOB_STATUSES: ReadonlyArray<JobStatus> = ["draft", "open", "paused", "closed"]
const EMPLOYMENTS: ReadonlyArray<EmploymentType> = ["full_time", "part_time"]
const PAY_UNITS: ReadonlyArray<PayUnit> = ["month", "hour", "shift"]
const SOURCES: ReadonlyArray<ApplicationSource> = ["page", "chat", "manual"]
const INTERVIEW_STATUSES: ReadonlyArray<InterviewStatus> = ["proposed", "confirmed", "done", "cancelled", "no_show"]
const OFFER_STATUSES: ReadonlyArray<OfferStatus> = [
    "draft",
    "waiting",
    "sent",
    "accepted",
    "declined",
    "expired",
    "cancelled",
]

/** The member of a closed list a stored text names, or the fallback when it names none. */
const pick = <Value extends string>(list: ReadonlyArray<Value>, text: string, fallback: Value): Value =>
    list.find((item) => item === text) ?? fallback

const STAGE_NAMES: ReadonlySet<unknown> = new Set(STAGES)

/** True for a stage name. */
export const isStage = (value: unknown): value is Stage => STAGE_NAMES.has(value)

const numberOrNull = (value: number | string | null): number | null => (value === null ? null : Number(value))

/** The settings of a workspace. */
export const toSettings = (row: HiringSettingsRow): HiringSettings => ({
    workspaceId: row.workspace_id,
    publicSlug: row.public_slug,
    retentionDays: row.retention_days,
    notifyNewCandidate: row.notify_new_candidate,
    remindInterview: row.remind_interview,
    autoCloseWhenFilled: row.auto_close_when_filled,
    applyConsentText: row.apply_consent_text,
    adTone: row.ad_tone,
})

const toRequirements = (json: RequirementsRow | null): JobRequirements => ({
    skills: json?.skills ?? [],
    experienceYears: json?.experience_years ?? null,
    experienceNote: json?.experience_note ?? "",
    availability: json?.availability ?? [],
    mustHave: json?.must_have ?? [],
    niceToHave: json?.nice_to_have ?? [],
})

/** The requirements as the column stores them. */
export const requirementsJson = (requirements: JobRequirements): RequirementsRow => ({
    skills: [...requirements.skills],
    experience_years: requirements.experienceYears,
    experience_note: requirements.experienceNote,
    availability: [...requirements.availability],
    must_have: [...requirements.mustHave],
    nice_to_have: [...requirements.niceToHave],
})

const expectOfJson = (value: QuestionRow["expect"]): QuestionExpect | undefined => {
    if (value === "yes" || value === "no" || typeof value === "number") return value
    return Array.isArray(value) ? value : undefined
}

const toQuestion = (json: QuestionRow): JobQuestion => {
    const expect = expectOfJson(json.expect)
    return {
        id: json.id,
        text: json.text,
        type: pick(QUESTION_TYPES, json.type, "text"),
        required: json.required,
        ...(json.choices === undefined ? {} : { choices: json.choices }),
        ...(expect === undefined ? {} : { expect }),
    }
}

const expectToJson = (value: QuestionExpect): string | number | Array<string> =>
    typeof value === "object" ? [...value] : value

/** The questions as the column stores them. */
export const questionsJson = (questions: ReadonlyArray<JobQuestion>): Array<QuestionRow> =>
    questions.map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        required: question.required,
        ...(question.choices === undefined ? {} : { choices: [...question.choices] }),
        ...(question.expect === undefined ? {} : { expect: expectToJson(question.expect) }),
    }))

/** A job. */
export const toJob = (row: HiringJobsRow): JobRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    slug: row.slug,
    title: row.title,
    position: row.position,
    employmentType: pick(EMPLOYMENTS, row.employment_type, "full_time"),
    schedule: row.schedule,
    payMinVnd: numberOrNull(row.pay_min_vnd),
    payMaxVnd: numberOrNull(row.pay_max_vnd),
    payUnit: pick(PAY_UNITS, row.pay_unit, "month"),
    location: row.location,
    headcount: row.headcount,
    description: row.description,
    requirements: toRequirements(row.requirements),
    questions: (row.questions ?? []).map(toQuestion),
    status: pick(JOB_STATUSES, row.status, "draft"),
    channels: row.channels,
    closesAt: isoOrNull(row.closes_at),
})

const toAnswer = (json: AnswerRow): Answer => ({
    questionId: json.question_id,
    question: json.question,
    answer: json.answer,
})

/** A candidate. */
export const toCandidate = (row: HiringCandidatesRow): CandidateRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    jobId: row.job_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    source: pick(SOURCES, row.source, "page"),
    conversationId: row.conversation_id,
    cvPath: row.cv_path,
    cvName: row.cv_name,
    cvMime: row.cv_mime,
    answers: (row.answers ?? []).map(toAnswer),
    availability: row.availability,
    stage: isStage(row.stage) ? row.stage : "applied",
    staffId: row.staff_id,
})

const toSlot = (json: SlotRow): Slot => ({ start: json.start, end: json.end })

/** An interview. */
export const toInterview = (row: HiringInterviewsRow): InterviewRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    interviewerUserId: row.interviewer_user_id,
    interviewerName: row.interviewer_name,
    mode: row.mode === "online" ? "online" : "in_person",
    location: row.location,
    durationMin: row.duration_min,
    proposedSlots: (row.proposed_slots ?? []).map(toSlot),
    slotStart: isoOrNull(row.slot_start),
    slotEnd: isoOrNull(row.slot_end),
    status: pick(INTERVIEW_STATUSES, row.status, "proposed"),
    token: row.token,
    workItemId: row.work_item_id,
    note: row.note,
})

const toTerms = (json: TermsRow | null): OfferTerms => ({
    title: json?.title ?? "",
    pay: json?.pay ?? "",
    startDate: json?.start_date ?? "",
    probation: json?.probation ?? "",
    note: json?.note ?? "",
})

/** The terms as the column stores them. */
export const termsJson = (terms: OfferTerms): TermsRow => ({
    title: terms.title,
    pay: terms.pay,
    start_date: terms.startDate,
    probation: terms.probation,
    note: terms.note,
})

/** An offer. */
export const toOffer = (row: HiringOffersRow): OfferRecord => ({
    id: row.id,
    workspaceId: row.workspace_id,
    candidateId: row.candidate_id,
    jobId: row.job_id,
    terms: toTerms(row.terms),
    draft: row.draft,
    status: pick(OFFER_STATUSES, row.status, "draft"),
    token: row.token,
    workItemId: row.work_item_id,
    expiresAt: isoOrNull(row.expires_at),
})
