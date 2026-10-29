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
    HiringCandidateAnswer,
    HiringCandidateEntity,
    HiringInterviewEntity,
    HiringInterviewSlot,
    HiringJobEntity,
    HiringJobQuestion,
    HiringJobRequirements,
    HiringOfferEntity,
    HiringOfferTerms,
    HiringSettingEntity,
} from "../persistence/entities"
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

const numberOrNull = (value: string | null): number | null => (value === null ? null : Number(value))

/** The settings of a workspace. */
export const toSettings = (row: HiringSettingEntity): HiringSettings => ({
    workspaceId: row.workspaceId,
    publicSlug: row.publicSlug,
    retentionDays: row.retentionDays,
    notifyNewCandidate: row.notifyNewCandidate,
    remindInterview: row.remindInterview,
    autoCloseWhenFilled: row.autoCloseWhenFilled,
    applyConsentText: row.applyConsentText,
    adTone: row.adTone,
})

const toRequirements = (json: HiringJobRequirements | null): JobRequirements => ({
    skills: json?.skills ?? [],
    experienceYears: json?.experience_years ?? null,
    experienceNote: json?.experience_note ?? "",
    availability: json?.availability ?? [],
    mustHave: json?.must_have ?? [],
    niceToHave: json?.nice_to_have ?? [],
})

/** The requirements as the column stores them. */
export const requirementsJson = (requirements: JobRequirements): HiringJobRequirements => ({
    skills: [...requirements.skills],
    experience_years: requirements.experienceYears,
    experience_note: requirements.experienceNote,
    availability: [...requirements.availability],
    must_have: [...requirements.mustHave],
    nice_to_have: [...requirements.niceToHave],
})

/** Whether a stored expectation is a list of accepted choices (`Array.isArray` alone narrows to `any[]`). */
const isChoices = (value: unknown): value is Array<string> => Array.isArray(value)

const expectOfJson = (value: HiringJobQuestion["expect"]): QuestionExpect | undefined => {
    let expect: QuestionExpect | undefined
    if (value === "yes" || value === "no" || typeof value === "number" || isChoices(value)) expect = value
    return expect
}

const toQuestion = (json: HiringJobQuestion): JobQuestion => {
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
export const questionsJson = (questions: ReadonlyArray<JobQuestion>): Array<HiringJobQuestion> =>
    questions.map((question) => ({
        id: question.id,
        text: question.text,
        type: question.type,
        required: question.required,
        ...(question.choices === undefined ? {} : { choices: [...question.choices] }),
        ...(question.expect === undefined ? {} : { expect: expectToJson(question.expect) }),
    }))

/** A job. */
export const toJob = (row: HiringJobEntity): JobRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    title: row.title,
    position: row.position,
    employmentType: pick(EMPLOYMENTS, row.employmentType, "full_time"),
    schedule: row.schedule,
    payMinVnd: numberOrNull(row.payMinVnd),
    payMaxVnd: numberOrNull(row.payMaxVnd),
    payUnit: pick(PAY_UNITS, row.payUnit, "month"),
    location: row.location,
    headcount: row.headcount,
    description: row.description,
    requirements: toRequirements(row.requirements),
    questions: (row.questions ?? []).map(toQuestion),
    status: pick(JOB_STATUSES, row.status, "draft"),
    channels: row.channels,
    closesAt: isoOrNull(row.closesAt),
})

const toAnswer = (json: HiringCandidateAnswer): Answer => ({
    questionId: json.question_id,
    question: json.question,
    answer: json.answer,
})

/** A candidate. */
export const toCandidate = (row: HiringCandidateEntity): CandidateRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    jobId: row.jobId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    source: pick(SOURCES, row.source, "page"),
    conversationId: row.conversationId,
    cvPath: row.cvPath,
    cvName: row.cvName,
    cvMime: row.cvMime,
    answers: (row.answers ?? []).map(toAnswer),
    availability: row.availability,
    stage: isStage(row.stage) ? row.stage : "applied",
    staffId: row.staffId,
})

const toSlot = (json: HiringInterviewSlot): Slot => ({ start: json.start, end: json.end })

/** An interview. */
export const toInterview = (row: HiringInterviewEntity): InterviewRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    candidateId: row.candidateId,
    jobId: row.jobId,
    interviewerUserId: row.interviewerUserId,
    interviewerName: row.interviewerName,
    mode: row.mode === "online" ? "online" : "in_person",
    location: row.location,
    durationMin: row.durationMin,
    proposedSlots: (row.proposedSlots ?? []).map(toSlot),
    slotStart: isoOrNull(row.slotStart),
    slotEnd: isoOrNull(row.slotEnd),
    status: pick(INTERVIEW_STATUSES, row.status, "proposed"),
    token: row.token,
    workItemId: row.workItemId,
    note: row.note,
})

const toTerms = (json: HiringOfferTerms | null): OfferTerms => ({
    title: json?.title ?? "",
    pay: json?.pay ?? "",
    startDate: json?.start_date ?? "",
    probation: json?.probation ?? "",
    note: json?.note ?? "",
})

/** The terms as the column stores them. */
export const termsJson = (terms: OfferTerms): HiringOfferTerms => ({
    title: terms.title,
    pay: terms.pay,
    start_date: terms.startDate,
    probation: terms.probation,
    note: terms.note,
})

/** An offer. */
export const toOffer = (row: HiringOfferEntity): OfferRecord => ({
    id: row.id,
    workspaceId: row.workspaceId,
    candidateId: row.candidateId,
    jobId: row.jobId,
    terms: toTerms(row.terms),
    draft: row.draft,
    status: pick(OFFER_STATUSES, row.status, "draft"),
    token: row.token,
    workItemId: row.workItemId,
    expiresAt: isoOrNull(row.expiresAt),
})
