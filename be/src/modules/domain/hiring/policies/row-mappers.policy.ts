import type {
    EmploymentType,
    HiringSettings,
    JobQuestion,
    JobRecord,
    JobRequirements,
    JobStatus,
    PayUnit,
    QuestionExpect,
    QuestionType,
    Stage,
} from "../hiring.contracts"
import { STAGES } from "../hiring.contracts"
import type {
    HiringJobEntity,
    HiringJobQuestion,
    HiringJobRequirements,
    HiringSettingEntity,
} from "../persistence/entities"
import { isoOrNull } from "./vn-time.policy"

const QUESTION_TYPES: ReadonlyArray<QuestionType> = ["text", "yesno", "number", "choice"]
const JOB_STATUSES: ReadonlyArray<JobStatus> = ["draft", "open", "paused", "closed"]
const EMPLOYMENTS: ReadonlyArray<EmploymentType> = ["full_time", "part_time"]
const PAY_UNITS: ReadonlyArray<PayUnit> = ["month", "hour", "shift"]

/** The member of a closed list a stored text names, or the fallback when it names none. */
export const pick = <Value extends string>(list: ReadonlyArray<Value>, text: string, fallback: Value): Value =>
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
