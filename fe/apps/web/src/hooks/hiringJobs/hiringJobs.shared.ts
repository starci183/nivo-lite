import { linesOf } from "@/hooks/hiring"
import type { JobQuestionView, JobView } from "@/hooks/hiringWire"
import type { HiringJobQuestionRequest, SaveHiringJobRequest } from "@/modules/api"

/** The answer kinds a question can ask for. */
export const QUESTION_TYPES: ReadonlyArray<string> = ["text", "yesno", "number", "choice"]

/** The employment types of a job. */
export const EMPLOYMENT_TYPES: ReadonlyArray<string> = ["full_time", "part_time"]

/** The units a pay is counted in. */
export const PAY_UNITS: ReadonlyArray<string> = ["month", "hour", "shift"]

/** The places a job takes applications from. */
export const APPLY_CHANNELS: ReadonlyArray<string> = ["page", "chat"]

/** A job asks at most this many questions. */
export const MAX_QUESTIONS = 12

/** One question in the editor: the choices and the expected answer are the text the owner types. */
export interface HiringQuestionValues {
    id: string
    text: string
    type: string
    required: boolean
    choices: string
    expect: string
}

/** The values of the job editor form. */
export interface HiringJobValues {
    title: string
    position: string
    employmentType: string
    schedule: string
    payMin: number | null
    payMax: number | null
    payUnit: string
    location: string
    headcount: number
    description: string
    skills: string
    years: number | null
    experienceNote: string
    availability: string
    mustHave: string
    niceToHave: string
    questions: Array<HiringQuestionValues>
    channels: Array<string>
}

/** A new question id: short, unique enough within one job. */
export const newQuestionId = (): string => `q${Date.now().toString(36).slice(-5)}`

/** An empty question of the editor. */
export const blankQuestion = (): HiringQuestionValues => ({
    id: newQuestionId(),
    text: "",
    type: "text",
    required: false,
    choices: "",
    expect: "",
})

const expectText = (question: JobQuestionView): string => {
    if (question.type === "yesno") return question.expectYesNo ?? ""
    if (question.type === "number") return question.expectNumber === null ? "" : String(question.expectNumber)
    return question.expectChoices.join(", ")
}

const questionValues = (question: JobQuestionView): HiringQuestionValues => ({
    id: question.id,
    text: question.text,
    type: question.type,
    required: question.required,
    choices: question.choices.join(", "),
    expect: expectText(question),
})

/** The editor values of a job; a new job starts with the starter questions (already in the reader's language). */
export const jobDefaults = (job: JobView | null, starter: ReadonlyArray<string>): HiringJobValues => ({
    title: job?.title ?? "",
    position: job?.position ?? "",
    employmentType: job?.employmentType ?? "full_time",
    schedule: job?.schedule ?? "",
    payMin: job?.payMinVnd ?? null,
    payMax: job?.payMaxVnd ?? null,
    payUnit: job?.payUnit ?? "month",
    location: job?.location ?? "",
    headcount: job?.headcount ?? 1,
    description: job?.description ?? "",
    skills: (job?.requirements.skills ?? []).join("\n"),
    years: job?.requirements.experienceYears ?? null,
    experienceNote: job?.requirements.experienceNote ?? "",
    availability: (job?.requirements.availability ?? []).join("\n"),
    mustHave: (job?.requirements.mustHave ?? []).join("\n"),
    niceToHave: (job?.requirements.niceToHave ?? []).join("\n"),
    questions:
        job === null || job.questions.length === 0
            ? starter.map((text, index) => ({ ...blankQuestion(), id: `q${index + 1}`, text, required: true }))
            : job.questions.map(questionValues),
    channels: job === null ? [...APPLY_CHANNELS] : [...job.channels],
})

const commaList = (text: string): Array<string> =>
    text
        .split(",")
        .map((part) => part.trim())
        .filter((part) => part !== "")

const questionInput = (question: HiringQuestionValues): HiringJobQuestionRequest => {
    const expectNumber = question.expect.trim() !== "" ? Number(question.expect) : Number.NaN
    return {
        id: question.id,
        text: question.text.trim(),
        type: question.type,
        required: question.required,
        choices: question.type === "choice" ? commaList(question.choices) : null,
        expectYesNo: question.type === "yesno" && ["yes", "no"].includes(question.expect) ? question.expect : null,
        expectNumber: question.type === "number" && Number.isFinite(expectNumber) ? expectNumber : null,
        expectChoices: question.type === "choice" ? commaList(question.expect) : null,
    }
}

/** The `saveHiringJob` input of the editor values; `id` is null for a new job. */
export const toJobInput = (values: HiringJobValues, id: string | null): SaveHiringJobRequest => ({
    ...(id === null ? {} : { id }),
    title: values.title.trim(),
    position: values.position,
    employmentType: values.employmentType,
    schedule: values.schedule,
    payMinVnd: values.payMin,
    payMaxVnd: values.payMax,
    payUnit: values.payUnit,
    location: values.location,
    headcount: values.headcount,
    description: values.description,
    requirements: {
        skills: linesOf(values.skills),
        experienceYears: values.years,
        experienceNote: values.experienceNote,
        availability: linesOf(values.availability),
        mustHave: linesOf(values.mustHave),
        niceToHave: linesOf(values.niceToHave),
    },
    questions: values.questions.filter((question) => question.text.trim() !== "").map(questionInput),
    channels: values.channels,
})

/** A job title needs at least this many characters. */
export const JOB_TITLE_MIN = 3
